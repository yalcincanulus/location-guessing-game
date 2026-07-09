import type { Attachment, Client, Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import {
  findGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "../../domain/geocoding/google-maps-parser.ts";
import { startGame, handleGuess } from "../../domain/game/game-service.ts";
import { isOfficiallyCovered } from "../../domain/countries/official-coverage.ts";
import { getActiveGameState, updateGameState } from "../../domain/game/active-game-state.ts";
import { hasVerifiedRole, isConfiguredGameChannel } from "../permissions.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import { handleCommand, isCommandMessage } from "../../commands/command-registry.ts";
import { scheduleIdleMultiplier } from "../../jobs/queues.ts";
import { logger } from "../../util/logger.ts";
import { sqlClient } from "../../db/client.ts";
import { messages } from "../../i18n/messages.ts";

type PendingStart = {
  googleMapsUrl?: string;
  screenshotUrl?: string;
  screenshotName?: string;
  guildId?: string;
  channelId?: string;
};

type CapturedScreenshot = {
  url: string;
  name: string;
  buffer: Buffer;
};

const isImageAttachment = (attachment: Attachment) =>
  Boolean(
    attachment.contentType?.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(attachment.name || attachment.url),
  );

const firstImageAttachment = (message: Message) =>
  message.attachments.find((attachment) => isImageAttachment(attachment));

const downloadScreenshot = async (attachment: Attachment): Promise<CapturedScreenshot> => {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download screenshot (${response.status})`);
  }

  return {
    url: attachment.url,
    name: attachment.name || messages.filenames.fallbackScreenshot,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
};

const getPending = async (key: string): Promise<PendingStart> => {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as PendingStart) : {};
};

const setPending = async (key: string, pending: PendingStart, ttlSeconds: number) => {
  await redis.set(key, JSON.stringify(pending), "EX", ttlSeconds);
};

const storePendingScreenshot = async (
  pendingKey: string,
  screenshot: CapturedScreenshot,
  ttlSeconds: number,
) => {
  await redis.set(keys.pendingScreenshot(pendingKey), screenshot.buffer, "EX", ttlSeconds);
};

const loadPendingScreenshot = async (pendingKey: string) => {
  const buffer = await redis.getBuffer(keys.pendingScreenshot(pendingKey));
  return buffer ?? undefined;
};

const clearPending = async (pendingKey: string) => {
  await redis.del(pendingKey, keys.pendingScreenshot(pendingKey));
};

const completeStartIfReady = async (
  client: Client,
  message: Message,
  pendingKey: string,
  pending: PendingStart,
) => {
  const rules = await loadRules();
  if (!pending.googleMapsUrl || !pending.screenshotUrl) {
    return false;
  }

  const channelId = pending.channelId ?? rules.gameChannelId;
  if (!channelId) {
    await message.reply(messages.start.gameChannelNotConfigured);
    return true;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    await message.reply(messages.start.configuredGameChannelUnavailable);
    return true;
  }

  const active = await getActiveGameState(channel.guild.id, channel.id);
  if (active) {
    await message.reply(messages.start.activeGameAlreadyExists);
    return true;
  }

  const parsedLocation = await parseGoogleMapsUrl(pending.googleMapsUrl);
  if (!parsedLocation) {
    await message.reply(messages.start.couldNotExtractCoordinates);
    return true;
  }

  const screenshotBuffer =
    (await loadPendingScreenshot(pendingKey)) ??
    Buffer.from(await (await fetch(pending.screenshotUrl)).arrayBuffer());

  const started = await startGame({
    guildChannel: channel,
    gameMaster: message.author,
    location: parsedLocation,
    screenshotUrl: pending.screenshotUrl,
  });

  if (channel.isSendable()) {
    const filename = pending.screenshotName || messages.filenames.fallbackScreenshot;
    const announcement = await channel.send({
      content: messages.start.gameStarted(message.author.id, {
        inTheGame: isOfficiallyCovered(started.state.targetCountryCode),
        coverageSource: parsedLocation.coverageSource,
      }),
      files: [new AttachmentBuilder(screenshotBuffer, { name: filename })],
    });

    const durableScreenshotUrl = announcement.attachments.first()?.url;
    if (durableScreenshotUrl) {
      started.state.screenshotUrl = durableScreenshotUrl;
      await updateGameState(started.state);
      await sqlClient`
        UPDATE game
        SET
          screenshot_url = ${durableScreenshotUrl},
          screenshot_message_id = ${announcement.id},
          announcement_message_id = ${announcement.id},
          updated_at = now()
        WHERE id = ${started.state.gameId}
      `;
    }
  }

  await scheduleIdleMultiplier(started.state.gameId, rules.idleMultiplierIntervalSeconds * 1000);
  return true;
};

const resolveGameChannel = async (client: Client, gameChannelId: string) => {
  const channel = await client.channels.fetch(gameChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    return null;
  }
  return channel;
};

const handleDmStart = async (client: Client, message: Message) => {
  const rules = await loadRules();
  if (!rules.gameChannelId) {
    await message.reply(messages.start.gameChannelNotConfigured);
    return;
  }

  const channel = await resolveGameChannel(client, rules.gameChannelId);
  if (!channel) {
    await message.reply(messages.start.configuredGameChannelUnavailable);
    return;
  }

  const member = await channel.guild.members.fetch(message.author.id).catch(() => null);
  if (!hasVerifiedRole(member, rules)) {
    await message.reply(messages.start.needsVerifiedRole);
    return;
  }

  const googleMapsUrl = findGoogleMapsUrl(message.content);
  const attachment = firstImageAttachment(message);

  // Share the same pending key as channel starts so hybrid DM↔channel
  // submissions can complete each other.
  const key = keys.pendingStart(channel.guild.id, message.author.id);
  const pending = await getPending(key);

  if (!googleMapsUrl && !attachment && !pending.googleMapsUrl && !pending.screenshotUrl) {
    await message.reply(messages.start.sendLinkAndScreenshot);
    return;
  }

  pending.googleMapsUrl = googleMapsUrl ?? pending.googleMapsUrl;
  pending.guildId = channel.guild.id;
  pending.channelId = rules.gameChannelId;

  if (attachment) {
    const screenshot = await downloadScreenshot(attachment);
    pending.screenshotUrl = screenshot.url;
    pending.screenshotName = screenshot.name;
    await storePendingScreenshot(key, screenshot, rules.pendingStartTtlSeconds);
  }

  const completed = await completeStartIfReady(client, message, key, pending);
  if (completed) {
    await clearPending(key);
    return;
  }

  await setPending(key, pending, rules.pendingStartTtlSeconds);
  if (pending.googleMapsUrl && !pending.screenshotUrl) {
    await message.reply(messages.start.nowSendScreenshot);
    return;
  }
  if (pending.screenshotUrl && !pending.googleMapsUrl) {
    await message.reply(messages.start.nowSendGoogleMapsLink);
    return;
  }
  await message.reply(messages.start.sendLinkAndScreenshot);
};

const handleChannelStart = async (client: Client, message: Message<true>) => {
  const rules = await loadRules();
  if (!isConfiguredGameChannel(message, rules)) {
    return false;
  }

  if (!hasVerifiedRole(message.member, rules)) {
    return false;
  }

  const active = await getActiveGameState(message.guild.id, message.channel.id);
  if (active) {
    return false;
  }

  const googleMapsUrl = findGoogleMapsUrl(message.content);
  const attachment = firstImageAttachment(message);
  const key = keys.pendingStart(message.guild.id, message.author.id);
  const pending = await getPending(key);

  // Accept a Maps link (optionally with image), or a follow-up image after a
  // channel/DM link is already pending. Standalone images are ignored so
  // memes/chat photos do not begin a pending game start. A DM screenshot can
  // still complete a channel link (and vice versa) via the shared pending key.
  if (!googleMapsUrl && !(attachment && pending.googleMapsUrl)) {
    return false;
  }

  pending.googleMapsUrl = googleMapsUrl ?? pending.googleMapsUrl;
  pending.guildId = message.guild.id;
  pending.channelId = message.channel.id;

  // Download before deleting so Discord attachment URLs remain usable.
  if (attachment) {
    const screenshot = await downloadScreenshot(attachment);
    pending.screenshotUrl = screenshot.url;
    pending.screenshotName = screenshot.name;
    await storePendingScreenshot(key, screenshot, rules.pendingStartTtlSeconds);
  }

  await message.delete().catch(() => undefined);

  const completed = await completeStartIfReady(client, message, key, pending);
  if (completed) {
    await clearPending(key);
    return true;
  }

  await setPending(key, pending, rules.pendingStartTtlSeconds);
  return true;
};

export const onMessageCreate = (client: Client) => async (message: Message) => {
  if (message.author.bot) {
    return;
  }

  try {
    if (!message.inGuild()) {
      await handleDmStart(client, message);
      return;
    }

    const rules = await loadRules();
    if (await isCommandMessage(message.content)) {
      await handleCommand(message);
      return;
    }

    if (await handleChannelStart(client, message)) {
      return;
    }

    if (!isConfiguredGameChannel(message, rules) || !hasVerifiedRole(message.member, rules)) {
      return;
    }

    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      return;
    }

    const result = await handleGuess(message, state);
    if (result === "ignored" || result === "game-master-blocked") {
      return;
    }

    if (result === "rate-limited") {
      await message.react("⏳").catch(() => undefined);
      return;
    }

    await message.react(result).catch(() => undefined);
  } catch (error) {
    logger.error("Message handling failed", {
      messageId: message.id,
      channelId: message.channel.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
