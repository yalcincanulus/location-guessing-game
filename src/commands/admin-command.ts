import type { GuildTextBasedChannel, Message } from "discord.js";
import { isBotAdmin } from "../bot/admin.ts";
import {
  MAX_MAX_CONSECUTIVE_GUESSES,
  MIN_MAX_CONSECUTIVE_GUESSES,
  parseMaxConsecutiveGuesses,
} from "../config/max-consecutive-guesses.ts";
import { parseGameStartsEnabled } from "../config/game-starts.ts";
import {
  loadRules,
  updateGameStartsEnabled,
  updateMaxConsecutiveGuesses,
} from "../config/rules.ts";
import {
  cancelOrFailActiveGame,
  clearChannelStartState,
  getActiveGameContext,
} from "../domain/game/admin-game-ops.ts";
import { clearGuessStreaks, getWrongCountries } from "../domain/game/active-game-state.ts";
import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { runPeriodAwardsForType } from "../domain/awards/announce.ts";
import type { PeriodType } from "../domain/awards/periods.ts";
import { runAchievementsBackfill } from "../domain/achievements/hooks.ts";
import { runIdleMultiplierCheck } from "../jobs/queues.ts";
import { messages } from "../i18n/messages.ts";
import { truncateFeedback } from "../domain/feedback.ts";
import { getFeedbackById, listFeedback } from "../repositories/feedback-repository.ts";
import { clearFeedbackRateLimit } from "../repositories/feedback-rate-limit-repository.ts";
import { findPlayersByDisplayName } from "../repositories/core-repository.ts";
import { handleAdminReviewCommand } from "./admin-review-command.ts";
import { gameChannelIdFor, parseModeToken, type GameMode } from "../domain/game/game-mode.ts";
import { getProvinceName } from "../domain/provinces/normalize-province-guess.ts";
import type { ActiveDbGame } from "../domain/game/admin-game-ops.ts";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

type GameChannelContext = {
  mode: GameMode;
  guildId: string;
  channelId: string;
  channel: GuildTextBasedChannel;
};

const resolveGameChannelContext = async (
  message: Message,
  mode: GameMode,
): Promise<{ ok: true; ctx: GameChannelContext } | { ok: false }> => {
  const rules = await loadRules();
  const gameChannelId = gameChannelIdFor(rules, mode);
  if (!gameChannelId) {
    await message.reply(
      mode === "province"
        ? messages.province.channelNotConfigured
        : messages.admin.gameChannelNotConfigured,
    );
    return { ok: false };
  }

  const channel = await message.client.channels.fetch(gameChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    await message.reply(
      mode === "province"
        ? messages.province.channelUnavailable
        : messages.admin.gameChannelUnavailable,
    );
    return { ok: false };
  }

  return {
    ok: true,
    ctx: {
      mode,
      guildId: channel.guild.id,
      channelId: channel.id,
      channel: channel as GuildTextBasedChannel,
    },
  };
};

/** Province output starts with the province label so admins can tell the modes apart. */
const withModeLabel = (mode: GameMode, text: string) =>
  mode === "province" ? `${messages.province.label}\n${text}` : text;

const dbGameTarget = (dbGame: ActiveDbGame) =>
  dbGame.provinceCode
    ? `${dbGame.provinceCode} - ${getProvinceName(dbGame.provinceCode)}`
    : `${dbGame.countryCode} - ${dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode, messages.locale)}`;

const helpCommand = async (message: Message) => {
  await message.reply(messages.admin.help);
  return true;
};

const FEEDBACK_LIST_DEFAULT_LIMIT = 20;
const FEEDBACK_LIST_MAX_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const splitForDiscord = (lines: string[], maxLength = 1_900) => {
  const chunks: string[] = [];
  let chunk = "";

  const append = (line: string) => {
    if (!line) {
      return;
    }

    if (line.length > maxLength) {
      if (chunk) {
        chunks.push(chunk);
        chunk = "";
      }
      for (let offset = 0; offset < line.length; offset += maxLength) {
        chunks.push(line.slice(offset, offset + maxLength));
      }
      return;
    }

    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length > maxLength) {
      if (chunk) {
        chunks.push(chunk);
      }
      chunk = line;
    } else {
      chunk = next;
    }
  };

  for (const line of lines) {
    append(line);
  }
  if (chunk) {
    chunks.push(chunk);
  }
  return chunks;
};

const replyChunked = async (message: Message, lines: string[]) => {
  for (const chunk of splitForDiscord(lines)) {
    await message.reply({
      content: chunk,
      allowedMentions: { parse: [] },
    });
  }
};

const parseFeedbackLimit = (value: string | undefined) => {
  if (value === undefined || value === "") {
    return FEEDBACK_LIST_DEFAULT_LIMIT;
  }

  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 && limit <= FEEDBACK_LIST_MAX_LIMIT
    ? limit
    : undefined;
};

const listFeedbackCommand = async (message: Message, limitArg?: string) => {
  const limit = parseFeedbackLimit(limitArg);
  if (limit === undefined) {
    await message.reply(messages.feedback.adminUsage);
    return true;
  }

  const rows = await listFeedback(limit);
  if (rows.length === 0) {
    await message.reply(messages.feedback.noFeedback);
    return true;
  }

  await replyChunked(message, [
    messages.feedback.adminHeader(rows.length),
    ...rows.map((row) =>
      messages.feedback.adminRow({
        id: row.id,
        displayName: row.displayName,
        discordUserId: row.discordUserId,
        createdAt: row.createdAt.toISOString(),
        message: truncateFeedback(row.message),
      }),
    ),
  ]);
  return true;
};

const viewFeedbackCommand = async (message: Message, id: string) => {
  if (!UUID_PATTERN.test(id)) {
    await message.reply(messages.feedback.adminUsage);
    return true;
  }

  const feedback = await getFeedbackById(id);
  if (!feedback) {
    await message.reply(messages.feedback.notFound);
    return true;
  }

  await replyChunked(message, [
    messages.feedback.adminDetail({
      id: feedback.id,
      displayName: feedback.displayName,
      discordUserId: feedback.discordUserId,
      createdAt: feedback.createdAt.toISOString(),
    }),
    feedback.message,
  ]);
  return true;
};

const clearFeedbackRateLimitCommand = async (message: Message, args: string[]) => {
  const displayName = args.join(" ").trim();
  if (!displayName) {
    await message.reply(messages.feedback.adminRateLimitClearUsage);
    return true;
  }

  const players = await findPlayersByDisplayName(displayName);
  if (players.length === 0) {
    await message.reply(messages.feedback.adminPlayerNotFound(displayName));
    return true;
  }

  if (players.length > 1) {
    await message.reply(
      messages.feedback.adminPlayerAmbiguous(
        displayName,
        players.map((player) => `${player.displayName} (${player.discordUserId})`),
      ),
    );
    return true;
  }

  const player = players[0]!;
  await clearFeedbackRateLimit(player.discordUserId);
  await message.reply(messages.feedback.adminRateLimitCleared(player.displayName));
  return true;
};

const feedbackCommand = async (message: Message, args: string[]) => {
  if (args.length === 0) {
    return listFeedbackCommand(message);
  }

  const action = normalize(args[0] ?? "");
  if (["clear", "reset", "temizle", "sifirla"].includes(action)) {
    return clearFeedbackRateLimitCommand(message, args.slice(1));
  }

  if (["list", "liste"].includes(action)) {
    if (args.length > 2) {
      await message.reply(messages.feedback.adminUsage);
      return true;
    }
    return listFeedbackCommand(message, args[1]);
  }

  if (["view", "show", "gor", "goster", "göster"].includes(action)) {
    if (args.length !== 2) {
      await message.reply(messages.feedback.adminUsage);
      return true;
    }
    return viewFeedbackCommand(message, args[1]!);
  }

  if (args.length === 1 && /^\d+$/.test(args[0] ?? "")) {
    return listFeedbackCommand(message, args[0]);
  }

  if (args.length === 1) {
    return viewFeedbackCommand(message, args[0]!);
  }

  await message.reply(messages.feedback.adminUsage);
  return true;
};

const statusCommand = async (message: Message, ctx: GameChannelContext) => {
  const { state, dbGame, redisMissingButDbActive } = await getActiveGameContext(
    ctx.guildId,
    ctx.channelId,
    ctx.mode,
  );
  const wrongCountries = state ? await getWrongCountries(state.gameId) : [];
  const target = dbGame ? dbGameTarget(dbGame) : undefined;

  await message.reply(
    withModeLabel(
      ctx.mode,
      messages.admin.status({
        game:
          dbGame && target
            ? {
                id: dbGame.gameId,
                status: dbGame.status,
                gameMasterDiscordUserId: dbGame.gameMasterDiscordUserId,
                target,
                regionName: dbGame.regionName,
              }
            : undefined,
        wrongCountryCount: wrongCountries.length,
        currentMultiplier: state?.currentMultiplier ?? dbGame?.currentMultiplier ?? 1,
        isTestGame: state?.isTest ?? dbGame?.isTest ?? false,
        redisMissingButDbActive,
      }),
    ),
  );
  return true;
};

const cancelCommand = async (message: Message, ctx: GameChannelContext, reason: string) => {
  const result = await cancelOrFailActiveGame({
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    status: "cancelled",
    reason,
    cancelledBy: message.author,
    mode: ctx.mode,
  });

  if (!result.ok) {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  await ctx.channel
    .send(messages.admin.cancelledAnnouncement(result.gameId, reason))
    .catch(() => undefined);
  await message.reply(messages.admin.cancelledGame(result.gameId));
  return true;
};

const revealCommand = async (message: Message, ctx: GameChannelContext) => {
  const { dbGame, redisMissingButDbActive } = await getActiveGameContext(
    ctx.guildId,
    ctx.channelId,
    ctx.mode,
  );
  if (!dbGame) {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  await message.reply(
    withModeLabel(
      ctx.mode,
      messages.admin.reveal({
        redisMissingButDbActive,
        answer: dbGameTarget(dbGame),
        regionName: dbGame.regionName,
        latitude: dbGame.latitude,
        longitude: dbGame.longitude,
      }),
    ),
  );
  return true;
};

const clearStartCommand = async (message: Message, ctx: GameChannelContext) => {
  const result = await clearChannelStartState(ctx.guildId, ctx.channelId);
  if (!result.ok) {
    await message.reply(messages.admin.noStartState);
    return true;
  }

  await message.reply(messages.admin.clearStartDone);
  return true;
};

const reloadCommand = async (message: Message) => {
  await loadRules(true);
  await message.reply(messages.admin.rulesReloaded);
  return true;
};

const startsCommand = async (message: Message, args: string[], mode: GameMode) => {
  const startsState = (rules: Awaited<ReturnType<typeof loadRules>>) =>
    mode === "province"
      ? messages.province.startsState(rules.provinceGameStartsEnabled)
      : messages.admin.startsState(rules.gameStartsEnabled);

  if (args.length > 1) {
    await message.reply(messages.admin.startsUsage);
    return true;
  }

  if (args.length === 0) {
    await message.reply(startsState(await loadRules(true)));
    return true;
  }

  const enabled = parseGameStartsEnabled(args[0] ?? "");
  if (enabled === undefined) {
    await message.reply(messages.admin.startsUsage);
    return true;
  }

  await message.reply(startsState(await updateGameStartsEnabled(enabled, mode)));
  return true;
};

const maxGuessesCommand = async (message: Message, args: string[]) => {
  const rules = await loadRules();
  if (args.length === 0) {
    await message.reply(messages.admin.maxGuessesCurrent(rules.maxConsecutiveGuesses));
    return true;
  }

  if (args.length !== 1) {
    await message.reply(
      messages.admin.maxGuessesUsage(
        rules.maxConsecutiveGuesses,
        MIN_MAX_CONSECUTIVE_GUESSES,
        MAX_MAX_CONSECUTIVE_GUESSES,
      ),
    );
    return true;
  }

  const next = parseMaxConsecutiveGuesses(args[0] ?? "");
  if (next === undefined) {
    await message.reply(
      messages.admin.maxGuessesUsage(
        rules.maxConsecutiveGuesses,
        MIN_MAX_CONSECUTIVE_GUESSES,
        MAX_MAX_CONSECUTIVE_GUESSES,
      ),
    );
    return true;
  }

  const previous = rules.maxConsecutiveGuesses;
  await updateMaxConsecutiveGuesses(next);
  await message.reply(messages.admin.maxGuessesUpdated(previous, next));
  return true;
};

const clearGuessesCommand = async (message: Message, ctx: GameChannelContext) => {
  const { state } = await getActiveGameContext(ctx.guildId, ctx.channelId, ctx.mode);
  if (!state) {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  await clearGuessStreaks(state.gameId);
  await message.reply(messages.admin.guessesCleared);
  return true;
};

const tickCommand = async (message: Message, ctx: GameChannelContext) => {
  const { state, dbGame } = await getActiveGameContext(ctx.guildId, ctx.channelId, ctx.mode);
  const gameId = state?.gameId ?? dbGame?.gameId;
  if (!gameId) {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  const result = await runIdleMultiplierCheck(message.client, gameId, { force: true });
  if (result.status === "missing-game") {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  if (result.status === "capped") {
    await message.reply(messages.admin.multiplierCapped(result.currentMultiplier));
    return true;
  }

  if (result.status === "increased") {
    await message.reply(
      messages.admin.forcedMultiplierTick(result.previousMultiplier, result.newMultiplier),
    );
    return true;
  }

  await message.reply(messages.admin.multiplierNoChange);
  return true;
};

const awardsPeriodAliases: Record<string, PeriodType> = {
  daily: "daily",
  gunluk: "daily",
  weekly: "weekly",
  haftalik: "weekly",
  monthly: "monthly",
  aylik: "monthly",
  seasonal: "seasonal",
  season: "seasonal",
  mevsim: "seasonal",
  mevsimlik: "seasonal",
  yearly: "yearly",
  year: "yearly",
  yillik: "yearly",
};

const awardsCommand = async (message: Message, args: string[], mode: GameMode) => {
  const periodArg = normalize(args[0] ?? "daily");
  const periodType = awardsPeriodAliases[periodArg];
  if (!periodType) {
    await message.reply(messages.admin.awardsInvalidPeriod);
    return true;
  }

  if (mode === "province" && !gameChannelIdFor(await loadRules(), mode)) {
    await message.reply(messages.province.channelNotConfigured);
    return true;
  }

  const result = await runPeriodAwardsForType(message.client, periodType, new Date(), mode);

  if (result.status === "skipped") {
    await message.reply(
      messages.admin.awardsAlreadyAnnounced(result.window.periodType, result.window.periodKey),
    );
    return true;
  }

  if (result.status === "announce-failed") {
    await message.reply(
      messages.admin.awardsAnnounceFailed(result.window.periodType, result.window.periodKey),
    );
    return true;
  }

  await message.reply(
    messages.admin.awardsFinalized(
      result.window.periodType,
      result.window.periodKey,
      result.medalCount,
    ),
  );
  return true;
};

export const handleAdminCommand = async (message: Message) => {
  if (!isBotAdmin(message.author.id)) {
    return false;
  }

  const rules = await loadRules();
  const prefix = rules.commandPrefixes.find((candidate) => message.content.startsWith(candidate));
  if (!prefix) {
    return false;
  }

  const parts = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = normalize(parts[0] ?? "");
  if (command !== "admin") {
    return false;
  }

  // `!admin il <subcommand>` targets the province channel and province stats.
  const explicitMode = parseModeToken(parts[1] ?? "");
  const mode = explicitMode ?? "country";
  const args = parts.slice(explicitMode ? 2 : 1);
  const subcommand = normalize(args[0] ?? "help");

  if (["help", "yardim", "yardım"].includes(subcommand)) {
    return helpCommand(message);
  }

  if (["reload", "yenile"].includes(subcommand)) {
    return reloadCommand(message);
  }

  if (["maxguesses", "maxtahmin", "maxconsecutive"].includes(subcommand)) {
    return maxGuessesCommand(message, args.slice(1));
  }

  if (["starts", "start", "baslat"].includes(subcommand)) {
    return startsCommand(message, args.slice(1), mode);
  }

  if (["awards", "oduller", "ödüller"].includes(subcommand)) {
    return awardsCommand(message, args.slice(1), mode);
  }

  if (["achievements", "basarim", "basarimlar"].includes(subcommand)) {
    const action = normalize(args[1] ?? "");
    if (action !== "backfill") {
      await message.reply(messages.admin.unknownCommand);
      return true;
    }
    const result = await runAchievementsBackfill(mode);
    await message.reply(
      withModeLabel(
        mode,
        messages.admin.achievementsBackfillDone(result.players, result.unlocks, result.errors),
      ),
    );
    return true;
  }

  if (["feedback", "geribildirim", "geribildirimler"].includes(subcommand)) {
    return feedbackCommand(message, args.slice(1));
  }

  if (await handleAdminReviewCommand(message, subcommand, args.slice(1), mode)) {
    return true;
  }

  const resolved = await resolveGameChannelContext(message, mode);
  if (!resolved.ok) {
    return true;
  }

  const { ctx } = resolved;

  if (["status", "durum"].includes(subcommand)) {
    return statusCommand(message, ctx);
  }

  if (["cancel", "iptal"].includes(subcommand)) {
    const reason = args.slice(1).join(" ").trim() || "admin cancel";
    return cancelCommand(message, ctx, reason);
  }

  if (["reveal", "cevap"].includes(subcommand)) {
    return revealCommand(message, ctx);
  }

  if (["clearstart", "baslangic", "başlangıç"].includes(subcommand)) {
    return clearStartCommand(message, ctx);
  }

  if (["tick", "carpan", "çarpan", "multiplier", "mult"].includes(subcommand)) {
    return tickCommand(message, ctx);
  }

  if (["clearguesses", "clearlimit", "tahminlimititemizle"].includes(subcommand)) {
    return clearGuessesCommand(message, ctx);
  }

  await message.reply(messages.admin.unknownCommand);
  return true;
};
