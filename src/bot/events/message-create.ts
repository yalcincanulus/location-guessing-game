import type { Attachment, Client, GuildBasedChannel, Message, User } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import {
  findGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "../../domain/geocoding/google-maps-parser.ts";
import {
  startGame,
  handleGuess,
  UntrustedReverseGeocodeCountryError,
} from "../../domain/game/game-service.ts";
import { onGameStarted } from "../../domain/achievements/hooks.ts";
import { isOfficiallyCovered } from "../../domain/countries/official-coverage.ts";
import { getActiveGameState, updateGameState } from "../../domain/game/active-game-state.ts";
import {
  clearPendingStart,
  clearStartReservation,
  tryClaimStartReservation,
  updateStartReservation,
  type StartReservationMissing,
} from "../../domain/game/start-reservation.ts";
import { hasVerifiedRole, isConfiguredGameChannel } from "../permissions.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import {
  handleCommand,
  handleAchievementsCommand,
  isCommandMessage,
} from "../../commands/command-registry.ts";
import { handleAdminCommand } from "../../commands/admin-command.ts";
import { isBotAdmin } from "../admin.ts";
import {
  cancelStartReservationExpiry,
  scheduleIdleMultiplier,
  scheduleStartReservationExpiry,
} from "../../jobs/queues.ts";
import { logger } from "../../util/logger.ts";
import { fitScreenshotForDiscord, MAX_SCREENSHOT_MB } from "../../util/fit-screenshot.ts";
import { sqlClient } from "../../db/client.ts";
import { messages } from "../../i18n/messages.ts";
import { handleFeedbackCommand } from "../../commands/feedback-command.ts";

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

const downloadScreenshot = async (
  attachment: Attachment,
): Promise<CapturedScreenshot | undefined> => {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download screenshot (${response.status})`);
  }

  const name = attachment.name || messages.filenames.fallbackScreenshot;
  const fitted = await fitScreenshotForDiscord(Buffer.from(await response.arrayBuffer()), name);
  if (!fitted) {
    return undefined;
  }

  return {
    url: attachment.url,
    name: fitted.name,
    buffer: fitted.buffer,
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
  return buffer ? Buffer.from(buffer) : undefined;
};

const dmUser = async (user: User, content: string) => {
  await user.send(content).catch(() => undefined);
};

const sendToGameChannel = async (channel: GuildBasedChannel, content: string) => {
  if (channel.isSendable()) {
    await channel.send(content);
  }
};

const missingPart = (pending: PendingStart): StartReservationMissing | undefined => {
  if (pending.googleMapsUrl && !pending.screenshotUrl) {
    return "screenshot";
  }
  if (pending.screenshotUrl && !pending.googleMapsUrl) {
    return "link";
  }
  return undefined;
};

const announceWaiting = async (
  channel: GuildBasedChannel,
  userId: string,
  missing: StartReservationMissing,
) => {
  await sendToGameChannel(
    channel,
    missing === "screenshot"
      ? messages.start.startingWaitingForScreenshot(userId)
      : messages.start.startingWaitingForLink(userId),
  );
};

const resolveGameChannel = async (client: Client, gameChannelId: string) => {
  const channel = await client.channels.fetch(gameChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    return null;
  }
  return channel;
};

const completeStartIfReady = async ({
  author,
  pendingKey,
  pending,
  gameChannel,
}: {
  author: User;
  pendingKey: string;
  pending: PendingStart;
  gameChannel: GuildBasedChannel;
}) => {
  if (!pending.googleMapsUrl || !pending.screenshotUrl) {
    return false;
  }

  const rules = await loadRules();
  const active = await getActiveGameState(gameChannel.guild.id, gameChannel.id);
  if (active) {
    await dmUser(author, messages.start.activeGameAlreadyExists);
    await clearPendingStart(pendingKey);
    await clearStartReservation(gameChannel.guild.id, gameChannel.id);
    await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
    return true;
  }

  const parsedLocation = await parseGoogleMapsUrl(pending.googleMapsUrl);
  if (!parsedLocation) {
    await sendToGameChannel(gameChannel, messages.start.couldNotExtractCoordinates);
    await clearPendingStart(pendingKey);
    await clearStartReservation(gameChannel.guild.id, gameChannel.id);
    await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
    return true;
  }

  const rawScreenshotBuffer =
    (await loadPendingScreenshot(pendingKey)) ??
    Buffer.from(await (await fetch(pending.screenshotUrl)).arrayBuffer());
  const fittedScreenshot = await fitScreenshotForDiscord(
    rawScreenshotBuffer,
    pending.screenshotName || messages.filenames.fallbackScreenshot,
  );
  if (!fittedScreenshot) {
    await sendToGameChannel(
      gameChannel,
      messages.start.screenshotTooLarge(author.id, MAX_SCREENSHOT_MB),
    );
    await clearPendingStart(pendingKey);
    await clearStartReservation(gameChannel.guild.id, gameChannel.id);
    await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
    return true;
  }

  const screenshotBuffer = fittedScreenshot.buffer;
  const screenshotName = fittedScreenshot.name;

  let started;
  try {
    started = await startGame({
      guildChannel: gameChannel,
      gameMaster: author,
      location: parsedLocation,
      screenshotUrl: pending.screenshotUrl,
    });
  } catch (error) {
    if (error instanceof UntrustedReverseGeocodeCountryError) {
      await dmUser(author, messages.start.untrustedLocation);
      await clearPendingStart(pendingKey);
      await clearStartReservation(gameChannel.guild.id, gameChannel.id);
      await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
      return true;
    }

    const messageText = error instanceof Error ? error.message : String(error);
    if (messageText.includes("Another game became active")) {
      await dmUser(author, messages.start.activeGameAlreadyExists);
      await clearPendingStart(pendingKey);
      await clearStartReservation(gameChannel.guild.id, gameChannel.id);
      await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
      return true;
    }
    throw error;
  }

  await clearPendingStart(pendingKey);
  await clearStartReservation(gameChannel.guild.id, gameChannel.id);
  await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);

  if (gameChannel.isSendable()) {
    const announcement = await gameChannel.send({
      content: messages.start.gameStarted(author.id, {
        inTheGame: isOfficiallyCovered(started.state.targetCountryCode),
        coverageSource: parsedLocation.coverageSource,
      }),
      files: [new AttachmentBuilder(screenshotBuffer, { name: screenshotName })],
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

  if (!started.state.isTest) {
    await onGameStarted(author.client, {
      playerId: started.state.gameMasterPlayerId,
      gameId: started.state.gameId,
      countryCode: started.state.targetCountryCode,
      at: new Date(),
    });
  }

  return true;
};

const processStartAttempt = async ({
  author,
  gameChannel,
  googleMapsUrl,
  attachment,
  deleteMessage,
}: {
  author: User;
  gameChannel: GuildBasedChannel;
  googleMapsUrl?: string;
  attachment?: Attachment;
  deleteMessage?: Message;
}) => {
  const rules = await loadRules();
  const ttlSeconds = rules.startReservationSeconds;
  const guildId = gameChannel.guild.id;
  const channelId = gameChannel.id;
  const pendingKey = keys.pendingStart(guildId, author.id);
  const hasBothParts = Boolean(googleMapsUrl && attachment);

  const active = await getActiveGameState(guildId, channelId);
  if (active) {
    if (deleteMessage) {
      await deleteMessage.delete().catch(() => undefined);
    }
    if (hasBothParts) {
      await dmUser(author, messages.start.activeGameAlreadyExists);
    }
    return;
  }

  const pending = await getPending(pendingKey);
  const nextPending: PendingStart = {
    ...pending,
    googleMapsUrl: googleMapsUrl ?? pending.googleMapsUrl,
    guildId,
    channelId,
  };

  const rejectUnusableScreenshot = async () => {
    if (deleteMessage) {
      await deleteMessage.delete().catch(() => undefined);
    }

    const notice = messages.start.screenshotTooLarge(author.id, MAX_SCREENSHOT_MB);
    if (deleteMessage) {
      await sendToGameChannel(gameChannel, notice);
    } else {
      await dmUser(author, notice);
    }

    // Keep any Maps link so the player can retry with a smaller screenshot.
    if (googleMapsUrl) {
      await setPending(pendingKey, { googleMapsUrl, guildId, channelId }, ttlSeconds);
      await redis.del(keys.pendingScreenshot(pendingKey));
      await processStartAttempt({
        author,
        gameChannel,
        googleMapsUrl,
      });
    }
  };

  let screenshot: CapturedScreenshot | undefined;
  if (attachment) {
    screenshot = await downloadScreenshot(attachment);
    if (!screenshot) {
      await rejectUnusableScreenshot();
      return;
    }

    nextPending.screenshotUrl = screenshot.url;
    nextPending.screenshotName = screenshot.name;
  }

  if (deleteMessage) {
    await deleteMessage.delete().catch(() => undefined);
  }

  const missing = missingPart(nextPending);
  const claim = await tryClaimStartReservation(
    guildId,
    channelId,
    {
      userId: author.id,
      missing: missing ?? "screenshot",
      pendingKey,
    },
    ttlSeconds,
  );

  if (claim === "blocked") {
    if (hasBothParts) {
      await dmUser(author, messages.start.activeGameAlreadyExists);
    }
    return;
  }

  if (screenshot) {
    await storePendingScreenshot(pendingKey, screenshot, ttlSeconds);
  }
  await setPending(pendingKey, nextPending, ttlSeconds);

  const completed = await completeStartIfReady({
    author,
    pendingKey,
    pending: nextPending,
    gameChannel,
  });
  if (completed) {
    return;
  }

  const stillMissing = missingPart(nextPending);
  if (!stillMissing) {
    return;
  }

  await updateStartReservation(guildId, channelId, {
    userId: author.id,
    missing: stillMissing,
    pendingKey,
  });

  if (claim === "claimed") {
    await announceWaiting(gameChannel, author.id, stillMissing);
    await scheduleStartReservationExpiry(
      guildId,
      channelId,
      author.id,
      pendingKey,
      stillMissing,
      ttlSeconds * 1000,
    );
  }
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
  if (!googleMapsUrl && !attachment) {
    return;
  }

  await processStartAttempt({
    author: message.author,
    gameChannel: channel,
    googleMapsUrl: googleMapsUrl ?? undefined,
    attachment,
  });
};

const handleChannelStart = async (_client: Client, message: Message<true>) => {
  const rules = await loadRules();
  if (!isConfiguredGameChannel(message, rules)) {
    return false;
  }

  if (!hasVerifiedRole(message.member, rules)) {
    return false;
  }

  const googleMapsUrl = findGoogleMapsUrl(message.content);
  const attachment = firstImageAttachment(message);
  const pendingKey = keys.pendingStart(message.guild.id, message.author.id);
  const pending = await getPending(pendingKey);

  // Accept a Maps link (optionally with image), or a follow-up image after a
  // channel/DM link is already pending. Standalone images are ignored so
  // memes/chat photos do not begin a pending game start.
  if (!googleMapsUrl && !(attachment && pending.googleMapsUrl)) {
    return false;
  }

  await processStartAttempt({
    author: message.author,
    gameChannel: message.channel,
    googleMapsUrl: googleMapsUrl ?? undefined,
    attachment,
    deleteMessage: message,
  });
  return true;
};

export const onMessageCreate = (client: Client) => async (message: Message) => {
  if (message.author.bot) {
    return;
  }

  try {
    if (!message.inGuild()) {
      if (await isCommandMessage(message.content)) {
        if (isBotAdmin(message.author.id) && (await handleAdminCommand(message))) {
          return;
        }
        if (await handleFeedbackCommand(message)) {
          return;
        }
        if (await handleAchievementsCommand(message)) {
          return;
        }
        await message.reply(messages.achievements.dmUsage);
        return;
      }
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
    if (result === "ignored" || result === "game-master-blocked" || result === "already-reacted") {
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
