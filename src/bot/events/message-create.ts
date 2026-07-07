import type { Client, Message, TextBasedChannel } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import {
  findGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "../../domain/geocoding/google-maps-parser.ts";
import { startGame, handleGuess } from "../../domain/game/game-service.ts";
import { getActiveGameState } from "../../domain/game/active-game-state.ts";
import { hasVerifiedRole, isConfiguredGameChannel } from "../permissions.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import { handleCommand, isCommandMessage } from "../../commands/command-registry.ts";
import { scheduleIdleMultiplier } from "../../jobs/queues.ts";
import { logger } from "../../util/logger.ts";

type PendingStart = {
  googleMapsUrl?: string;
  screenshotUrl?: string;
  guildId?: string;
  channelId?: string;
};

const firstImageAttachmentUrl = (message: Message) =>
  message.attachments.find(
    (attachment) =>
      attachment.contentType?.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)$/i.test(attachment.url),
  )?.url;

const getPending = async (key: string): Promise<PendingStart> => {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as PendingStart) : {};
};

const setPending = async (key: string, pending: PendingStart, ttlSeconds: number) => {
  await redis.set(key, JSON.stringify(pending), "EX", ttlSeconds);
};

const completeStartIfReady = async (client: Client, message: Message, pending: PendingStart) => {
  const rules = await loadRules();
  if (!pending.googleMapsUrl || !pending.screenshotUrl) {
    return false;
  }

  const channelId = pending.channelId ?? rules.gameChannelId;
  if (!channelId) {
    await message.reply("Game channel is not configured.");
    return true;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    await message.reply("Configured game channel is not available.");
    return true;
  }

  const active = await getActiveGameState(channel.guild.id, channel.id);
  if (active) {
    await message.reply("There is already an active game.");
    return true;
  }

  const parsedLocation = await parseGoogleMapsUrl(pending.googleMapsUrl);
  if (!parsedLocation) {
    await message.reply("I could not extract coordinates from that Google Maps link.");
    return true;
  }

  const started = await startGame({
    guildChannel: channel,
    gameMaster: message.author,
    location: parsedLocation,
    screenshotUrl: pending.screenshotUrl,
  });

  if (channel.isSendable()) {
    await channel.send({
      content: `<@${message.author.id}> started a new location game. Guess the country by typing its name or ISO code.`,
      embeds: [{ image: { url: pending.screenshotUrl } }],
    });
  }

  await scheduleIdleMultiplier(started.state.gameId, rules.idleMultiplierIntervalSeconds * 1000);
  return true;
};

const handleDmStart = async (client: Client, message: Message) => {
  const rules = await loadRules();
  if (!rules.gameChannelId) {
    await message.reply("Game channel is not configured.");
    return;
  }

  const guildId = rules.gameChannelId
    ? ((await client.channels
        .fetch(rules.gameChannelId)
        .catch(() => null)) as TextBasedChannel | null)
    : undefined;
  const channel = guildId && "guild" in guildId ? guildId : undefined;
  const member = channel?.guild
    ? await channel.guild.members.fetch(message.author.id).catch(() => null)
    : null;
  if (!hasVerifiedRole(member, rules)) {
    await message.reply("You need the verified role to start games.");
    return;
  }

  const key = keys.pendingDmStart(message.author.id);
  const pending = await getPending(key);
  pending.googleMapsUrl = findGoogleMapsUrl(message.content) ?? pending.googleMapsUrl;
  pending.screenshotUrl = firstImageAttachmentUrl(message) ?? pending.screenshotUrl;
  pending.channelId = rules.gameChannelId;

  const completed = await completeStartIfReady(client, message, pending);
  if (completed) {
    await redis.del(key);
    return;
  }

  await setPending(key, pending, rules.pendingStartTtlSeconds);
  await message.reply("Got it. Send the missing Google Maps link or screenshot to start the game.");
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
  const screenshotUrl = firstImageAttachmentUrl(message);
  if (!googleMapsUrl && !screenshotUrl) {
    return false;
  }

  const key = keys.pendingStart(message.guild.id, message.author.id);
  const pending = await getPending(key);
  pending.googleMapsUrl = googleMapsUrl ?? pending.googleMapsUrl;
  pending.screenshotUrl = screenshotUrl ?? pending.screenshotUrl;
  pending.guildId = message.guild.id;
  pending.channelId = message.channel.id;

  await message.delete().catch(() => undefined);

  const completed = await completeStartIfReady(client, message, pending);
  if (completed) {
    await redis.del(key);
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
