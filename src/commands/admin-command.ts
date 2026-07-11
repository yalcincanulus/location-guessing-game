import type { GuildTextBasedChannel, Message } from "discord.js";
import { isBotAdmin } from "../bot/admin.ts";
import { loadRules } from "../config/rules.ts";
import {
  cancelOrFailActiveGame,
  clearChannelStartState,
  getActiveGameContext,
} from "../domain/game/admin-game-ops.ts";
import { getWrongCountries } from "../domain/game/active-game-state.ts";
import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { runPeriodAwardsForType } from "../domain/awards/announce.ts";
import type { PeriodType } from "../domain/awards/periods.ts";
import { runIdleMultiplierCheck } from "../jobs/queues.ts";
import { messages } from "../i18n/messages.ts";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

type GameChannelContext = {
  guildId: string;
  channelId: string;
  channel: GuildTextBasedChannel;
};

const resolveGameChannelContext = async (
  message: Message,
): Promise<{ ok: true; ctx: GameChannelContext } | { ok: false }> => {
  const rules = await loadRules();
  if (!rules.gameChannelId) {
    await message.reply(messages.admin.gameChannelNotConfigured);
    return { ok: false };
  }

  const channel = await message.client.channels.fetch(rules.gameChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("guild" in channel) || !channel.guild) {
    await message.reply(messages.admin.gameChannelUnavailable);
    return { ok: false };
  }

  return {
    ok: true,
    ctx: {
      guildId: channel.guild.id,
      channelId: channel.id,
      channel: channel as GuildTextBasedChannel,
    },
  };
};

const helpCommand = async (message: Message) => {
  await message.reply(messages.admin.help);
  return true;
};

const statusCommand = async (message: Message, ctx: GameChannelContext) => {
  const { state, dbGame, redisMissingButDbActive } = await getActiveGameContext(
    ctx.guildId,
    ctx.channelId,
  );
  const wrongCountries = state ? await getWrongCountries(state.gameId) : [];
  const target = dbGame
    ? `${dbGame.countryCode} - ${dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode, messages.locale)}`
    : undefined;

  await message.reply(
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
  );
  if (!dbGame) {
    await message.reply(messages.admin.noActiveGame);
    return true;
  }

  await message.reply(
    messages.admin.reveal({
      redisMissingButDbActive,
      answer: `${dbGame.countryCode} - ${
        dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode, messages.locale)
      }`,
      regionName: dbGame.regionName,
      latitude: dbGame.latitude,
      longitude: dbGame.longitude,
    }),
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

const tickCommand = async (message: Message, ctx: GameChannelContext) => {
  const { state, dbGame } = await getActiveGameContext(ctx.guildId, ctx.channelId);
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

const awardsCommand = async (message: Message, args: string[]) => {
  const periodArg = normalize(args[0] ?? "daily");
  const periodType = awardsPeriodAliases[periodArg];
  if (!periodType) {
    await message.reply(messages.admin.awardsInvalidPeriod);
    return true;
  }

  const result = await runPeriodAwardsForType(message.client, periodType);

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
    await message.reply(messages.admin.unknownCommand);
    return true;
  }

  const args = parts.slice(1);
  const subcommand = normalize(args[0] ?? "help");

  if (["help", "yardim", "yardım"].includes(subcommand)) {
    return helpCommand(message);
  }

  if (["reload", "yenile"].includes(subcommand)) {
    return reloadCommand(message);
  }

  if (["awards", "oduller", "ödüller"].includes(subcommand)) {
    return awardsCommand(message, args.slice(1));
  }

  const resolved = await resolveGameChannelContext(message);
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

  await message.reply(messages.admin.unknownCommand);
  return true;
};
