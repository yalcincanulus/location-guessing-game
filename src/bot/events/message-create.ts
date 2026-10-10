import type {
  Attachment,
  ButtonInteraction,
  Client,
  GuildBasedChannel,
  Message,
  User,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import {
  findGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "../../domain/geocoding/google-maps-parser.ts";
import {
  startGame,
  handleGuess,
  LocationOutsideTurkeyError,
  UnknownProvinceError,
  UntrustedReverseGeocodeCountryError,
} from "../../domain/game/game-service.ts";
import {
  gameChannelIdFor,
  gameStartsEnabledFor,
  modeForChannel,
  tablesFor,
  type GameMode,
} from "../../domain/game/game-mode.ts";
import { reverseGeocode } from "../../domain/geocoding/nominatim-client.ts";
import { onGameStarted } from "../../domain/achievements/hooks.ts";
import { isOfficiallyCovered } from "../../domain/countries/official-coverage.ts";
import { getActiveGameState, updateGameState } from "../../domain/game/active-game-state.ts";
import {
  clearPendingStart,
  clearStartReservation,
  getStartReservation,
  tryClaimStartReservation,
  updateStartReservation,
  type StartReservationMissing,
} from "../../domain/game/start-reservation.ts";
import { hasVerifiedRole } from "../permissions.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import {
  handleCommand,
  handleAchievementsCommand,
  handleCancelCommand,
  handlePlayerMapCommand,
  handleProfileCommand,
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
import { resolveStartSource, type StartPartSource } from "../../domain/review/start-source.ts";
import { prepareGameScreenshot } from "../../domain/game/prepare-screenshot.ts";
import { buildGameAnnouncement } from "../../domain/game/game-announcement.ts";

type PendingStart = {
  googleMapsUrl?: string;
  screenshotUrl?: string;
  screenshotName?: string;
  linkSource?: StartPartSource;
  screenshotSource?: StartPartSource;
  guildId?: string;
  channelId?: string;
};

type CapturedScreenshot = {
  url: string;
  name: string;
  buffer: Buffer;
};

/** A DM start in Türkiye that waits for the player to pick country or province mode. */
type StartModeChoice = {
  id: string;
  googleMapsUrl: string;
  screenshotUrl?: string;
  screenshotName?: string;
};

const START_MODE_BUTTON_PREFIX = "start-mode";

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
  mode,
}: {
  author: User;
  pendingKey: string;
  pending: PendingStart;
  gameChannel: GuildBasedChannel;
  mode: GameMode;
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
  const fittedScreenshot = await prepareGameScreenshot(
    rawScreenshotBuffer,
    pending.screenshotName || messages.filenames.fallbackScreenshot,
    rules.fairPlayNoticeEnabled ? messages.fairPlay.footer : undefined,
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

  let started;
  try {
    started = await startGame({
      guildChannel: gameChannel,
      gameMaster: author,
      location: parsedLocation,
      screenshotUrl: pending.screenshotUrl,
      startSource: resolveStartSource(pending.linkSource, pending.screenshotSource),
      mode,
    });
  } catch (error) {
    if (error instanceof LocationOutsideTurkeyError || error instanceof UnknownProvinceError) {
      await sendToGameChannel(
        gameChannel,
        error instanceof LocationOutsideTurkeyError
          ? messages.province.outsideTurkey(author.id)
          : messages.province.unknownProvince(author.id),
      );
      await clearPendingStart(pendingKey);
      await clearStartReservation(gameChannel.guild.id, gameChannel.id);
      await cancelStartReservationExpiry(gameChannel.guild.id, gameChannel.id);
      return true;
    }

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
    const announcement = await gameChannel.send(
      buildGameAnnouncement(
        mode === "province"
          ? messages.province.gameStarted(author.id, {
              coverageSource: parsedLocation.coverageSource,
            })
          : messages.start.gameStarted(author.id, {
              inTheGame: isOfficiallyCovered(started.state.targetCountryCode),
              coverageSource: parsedLocation.coverageSource,
            }),
        fittedScreenshot,
      ),
    );

    const durableScreenshotUrl = announcement.attachments.first()?.url;
    if (durableScreenshotUrl) {
      started.state.screenshotUrl = durableScreenshotUrl;
      started.state.screenshotMessageId = announcement.id;
      await updateGameState(started.state);
    }
    await sqlClient`
      UPDATE ${sqlClient(tablesFor(mode).game)}
      SET
        screenshot_url = COALESCE(${durableScreenshotUrl ?? null}, screenshot_url),
        screenshot_message_id = ${announcement.id},
        announcement_message_id = ${announcement.id},
        announced_at = ${announcement.createdAt},
        updated_at = now()
      WHERE id = ${started.state.gameId}
    `;

    if (rules.fairPlayNoticeEnabled) {
      await gameChannel.send(messages.fairPlay.reminder).catch((error: unknown) => {
        logger.warn("Could not send the fair play reminder", { error });
      });
    }
  }

  await scheduleIdleMultiplier(started.state.gameId, rules.idleMultiplierIntervalSeconds * 1000);

  if (!started.state.isTest) {
    await onGameStarted(author.client, {
      mode,
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
  screenshot: capturedScreenshot,
  deleteMessage,
  source,
  mode,
}: {
  author: User;
  gameChannel: GuildBasedChannel;
  googleMapsUrl?: string;
  attachment?: Attachment;
  /** Already downloaded screenshot (DM mode choice). Used instead of `attachment`. */
  screenshot?: CapturedScreenshot;
  deleteMessage?: Message;
  source: StartPartSource;
  mode: GameMode;
}) => {
  const rules = await loadRules();
  const ttlSeconds = rules.startReservationSeconds;
  const guildId = gameChannel.guild.id;
  const channelId = gameChannel.id;
  const pendingKey = keys.pendingStart(guildId, author.id, mode);
  const hasBothParts = Boolean(googleMapsUrl && (attachment || capturedScreenshot));

  if (!gameStartsEnabledFor(rules, mode)) {
    if (deleteMessage) {
      await deleteMessage.delete().catch(() => undefined);
    }
    await clearPendingStart(pendingKey);
    const reservation = await getStartReservation(guildId, channelId);
    if (reservation?.userId === author.id) {
      await clearStartReservation(guildId, channelId);
      await cancelStartReservationExpiry(guildId, channelId);
    }
    const notice =
      mode === "province"
        ? messages.province.startsClosed(author.id)
        : messages.start.startsClosed(author.id);
    if (deleteMessage) {
      await sendToGameChannel(gameChannel, notice);
    } else {
      await dmUser(author, notice);
    }
    return;
  }

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
    linkSource: googleMapsUrl ? source : pending.linkSource,
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
      await setPending(
        pendingKey,
        { googleMapsUrl, linkSource: source, guildId, channelId },
        ttlSeconds,
      );
      await redis.del(keys.pendingScreenshot(pendingKey));
      await processStartAttempt({
        author,
        gameChannel,
        googleMapsUrl,
        source,
        mode,
      });
    }
  };

  let screenshot = capturedScreenshot;
  if (!screenshot && attachment) {
    screenshot = await downloadScreenshot(attachment);
    if (!screenshot) {
      await rejectUnusableScreenshot();
      return;
    }
  }

  if (screenshot) {
    nextPending.screenshotUrl = screenshot.url;
    nextPending.screenshotName = screenshot.name;
    nextPending.screenshotSource = source;
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
    mode,
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

  if (await offerStartModeChoice(message, googleMapsUrl ?? undefined, attachment)) {
    return;
  }

  // A screenshot for a province start that already has its link goes to the province channel.
  if (!googleMapsUrl && attachment) {
    const provinceChannel = await pendingProvinceChannel(client, message.author.id);
    if (provinceChannel) {
      await processStartAttempt({
        author: message.author,
        gameChannel: provinceChannel,
        attachment,
        source: "dm",
        mode: "province",
      });
      return;
    }
  }

  await processStartAttempt({
    author: message.author,
    gameChannel: channel,
    googleMapsUrl: googleMapsUrl ?? undefined,
    attachment,
    source: "dm",
    mode: "country",
  });
};

const getStartModeChoice = async (userId: string) => {
  const raw = await redis.get(keys.startModeChoice(userId));
  return raw ? (JSON.parse(raw) as StartModeChoice) : undefined;
};

const saveStartModeChoice = async (
  userId: string,
  choice: StartModeChoice,
  screenshot: CapturedScreenshot | undefined,
  ttlSeconds: number,
) => {
  await redis.set(keys.startModeChoice(userId), JSON.stringify(choice), "EX", ttlSeconds);
  if (screenshot) {
    await redis.set(keys.startModeChoiceScreenshot(userId), screenshot.buffer, "EX", ttlSeconds);
  } else if (choice.screenshotUrl) {
    await redis.expire(keys.startModeChoiceScreenshot(userId), ttlSeconds);
  } else {
    await redis.del(keys.startModeChoiceScreenshot(userId));
  }
};

/** Removes the choice and returns its screenshot, if it has one. */
const takeStartModeChoiceScreenshot = async (
  userId: string,
  choice: StartModeChoice,
): Promise<CapturedScreenshot | undefined> => {
  const buffer = await redis.getBuffer(keys.startModeChoiceScreenshot(userId));
  await redis.del(keys.startModeChoice(userId), keys.startModeChoiceScreenshot(userId));
  if (!buffer || !choice.screenshotUrl) {
    return undefined;
  }
  return {
    url: choice.screenshotUrl,
    name: choice.screenshotName || messages.filenames.fallbackScreenshot,
    buffer: Buffer.from(buffer),
  };
};

const isInTurkey = async (googleMapsUrl: string) => {
  try {
    const parsed = await parseGoogleMapsUrl(googleMapsUrl);
    if (!parsed) {
      return false;
    }
    // Turkish, like province games, so a province start reuses this cached answer.
    const geocode = await reverseGeocode(parsed.latitude, parsed.longitude, "tr");
    return geocode.countryCode === "TR";
  } catch (error) {
    // The normal country start reports parse and geocode errors.
    logger.warn("Could not check the DM start location for Türkiye", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * DM starts in Türkiye can be a country game or a province game. Ask with buttons
 * and hold the link (and screenshot) until the player picks. Returns true when the
 * message was handled here.
 */
const offerStartModeChoice = async (
  message: Message,
  googleMapsUrl: string | undefined,
  attachment: Attachment | undefined,
) => {
  const rules = await loadRules();
  const author = message.author;
  const ttlSeconds = rules.pendingStartTtlSeconds;
  const existing = await getStartModeChoice(author.id);

  let screenshot: CapturedScreenshot | undefined;
  const captureScreenshot = async () => {
    if (!attachment) {
      return;
    }
    screenshot = await downloadScreenshot(attachment);
    if (!screenshot) {
      await dmUser(author, messages.start.screenshotTooLarge(author.id, MAX_SCREENSHOT_MB));
    }
  };

  if (!googleMapsUrl) {
    // A screenshot while the choice is still open belongs to that choice.
    if (!existing || !attachment) {
      return false;
    }
    await captureScreenshot();
    if (screenshot) {
      await saveStartModeChoice(
        author.id,
        { ...existing, screenshotUrl: screenshot.url, screenshotName: screenshot.name },
        screenshot,
        ttlSeconds,
      );
      await message.reply(messages.province.chooseModeScreenshotSaved);
    }
    return true;
  }

  if (
    !rules.provinceGameChannelId ||
    !rules.provinceGameStartsEnabled ||
    !(await isInTurkey(googleMapsUrl))
  ) {
    // A new link outside Türkiye replaces any open choice.
    if (existing) {
      await redis.del(keys.startModeChoice(author.id), keys.startModeChoiceScreenshot(author.id));
    }
    return false;
  }

  await captureScreenshot();
  // A new link replaces an open choice. Keep its screenshot if this message has none.
  const keepScreenshot = !screenshot && existing?.screenshotUrl;
  const choice: StartModeChoice = {
    id: crypto.randomUUID().slice(0, 8),
    googleMapsUrl,
    screenshotUrl: screenshot?.url ?? (keepScreenshot ? existing.screenshotUrl : undefined),
    screenshotName: screenshot?.name ?? (keepScreenshot ? existing.screenshotName : undefined),
  };
  await saveStartModeChoice(author.id, choice, screenshot, ttlSeconds);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${START_MODE_BUTTON_PREFIX}:country:${choice.id}`)
      .setLabel(messages.province.chooseCountryButton)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${START_MODE_BUTTON_PREFIX}:province:${choice.id}`)
      .setLabel(messages.province.chooseProvinceButton)
      .setStyle(ButtonStyle.Success),
  );
  await message.reply({ content: messages.province.chooseModePrompt, components: [buttons] });
  return true;
};

/** Province channel when the player has a province start that still waits for a screenshot. */
const pendingProvinceChannel = async (client: Client, userId: string) => {
  const rules = await loadRules();
  if (!rules.provinceGameChannelId) {
    return null;
  }
  const channel = await resolveGameChannel(client, rules.provinceGameChannelId);
  if (!channel) {
    return null;
  }
  const pending = await getPending(keys.pendingStart(channel.guild.id, userId, "province"));
  return pending.googleMapsUrl ? channel : null;
};

/**
 * A player who sent the screenshot first already holds the country channel.
 * When they pick province mode, take that screenshot and free the country channel.
 */
const moveCountryScreenshotToProvince = async (
  client: Client,
  user: User,
): Promise<CapturedScreenshot | undefined> => {
  const rules = await loadRules();
  if (!rules.gameChannelId) {
    return undefined;
  }
  const countryChannel = await resolveGameChannel(client, rules.gameChannelId);
  if (!countryChannel) {
    return undefined;
  }

  const guildId = countryChannel.guild.id;
  const pendingKey = keys.pendingStart(guildId, user.id);
  const pending = await getPending(pendingKey);
  if (!pending.screenshotUrl || pending.googleMapsUrl) {
    return undefined;
  }
  const buffer = await loadPendingScreenshot(pendingKey);
  if (!buffer) {
    return undefined;
  }

  await clearPendingStart(pendingKey);
  const reservation = await getStartReservation(guildId, countryChannel.id);
  if (reservation?.userId === user.id) {
    await clearStartReservation(guildId, countryChannel.id);
    await cancelStartReservationExpiry(guildId, countryChannel.id);
    await sendToGameChannel(countryChannel, messages.province.startMovedToProvince(user.id));
  }

  return {
    url: pending.screenshotUrl,
    name: pending.screenshotName || messages.filenames.fallbackScreenshot,
    buffer,
  };
};

/** Handles the country / province buttons from a DM start. Returns false for other buttons. */
export const handleStartModeButton = async (interaction: ButtonInteraction) => {
  const [prefix, modeValue, choiceId] = interaction.customId.split(":");
  if (prefix !== START_MODE_BUTTON_PREFIX) {
    return false;
  }
  const mode: GameMode = modeValue === "province" ? "province" : "country";
  const user = interaction.user;

  const choice = await getStartModeChoice(user.id);
  if (!choice || choice.id !== choiceId) {
    await interaction
      .update({ content: messages.province.chooseModeExpired, components: [] })
      .catch(() => undefined);
    return true;
  }

  const choiceScreenshot = await takeStartModeChoiceScreenshot(user.id, choice);
  await interaction.update({
    content: `${messages.province.chooseModePrompt}\n${messages.province.chooseModeChosen(mode)}`,
    components: [],
  });

  const rules = await loadRules();
  const channelId = gameChannelIdFor(rules, mode);
  const channel = channelId ? await resolveGameChannel(interaction.client, channelId) : null;
  if (!channel) {
    await interaction.followUp(
      mode === "province"
        ? messages.province.channelUnavailable
        : messages.start.configuredGameChannelUnavailable,
    );
    return true;
  }

  const member = await channel.guild.members.fetch(user.id).catch(() => null);
  if (!hasVerifiedRole(member, rules)) {
    await interaction.followUp(messages.start.needsVerifiedRole);
    return true;
  }

  const screenshot =
    choiceScreenshot ??
    (mode === "province"
      ? await moveCountryScreenshotToProvince(interaction.client, user)
      : undefined);

  await processStartAttempt({
    author: user,
    gameChannel: channel,
    googleMapsUrl: choice.googleMapsUrl,
    screenshot,
    source: "dm",
    mode,
  });
  return true;
};

const handleChannelStart = async (_client: Client, message: Message<true>) => {
  const rules = await loadRules();
  const mode = modeForChannel(rules, message.channel.id);
  if (!mode) {
    return false;
  }

  if (!hasVerifiedRole(message.member, rules)) {
    return false;
  }

  const googleMapsUrl = findGoogleMapsUrl(message.content);
  const attachment = firstImageAttachment(message);
  const pendingKey = keys.pendingStart(message.guild.id, message.author.id, mode);
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
    source: "channel",
    mode,
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
        if (await handleCancelCommand(message)) {
          return;
        }
        if (await handleAchievementsCommand(message)) {
          return;
        }
        if (await handlePlayerMapCommand(message)) {
          return;
        }
        if (await handleProfileCommand(message)) {
          return;
        }
        await message.reply(`${messages.achievements.dmUsage}\n${messages.playerMap.usage}`);
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

    if (!modeForChannel(rules, message.channel.id) || !hasVerifiedRole(message.member, rules)) {
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
