import type { Message } from "discord.js";
import { loadRules } from "../config/rules.ts";
import { sqlClient } from "../db/client.ts";
import {
  clearGameKeys,
  getActiveGameState,
  getWrongCountries,
} from "../domain/game/active-game-state.ts";
import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { upsertPlayer } from "../repositories/core-repository.ts";
import { removeMultiplierJobsForGame, runIdleMultiplierCheck } from "../jobs/queues.ts";

type ActiveDbGame = {
  gameId: string;
  status: string;
  isTest: boolean;
  gameMasterDiscordUserId: string;
  countryCode: string;
  countryName?: string;
  regionName?: string;
  latitude: number;
  longitude: number;
  currentMultiplier: number;
};

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

const deny = async (message: Message<true>, reason: string) => {
  await message.reply(reason);
  return true;
};

const authorize = async (message: Message<true>) => {
  const rules = await loadRules(true);
  if (!rules.testModeEnabled) {
    return { ok: false as const, reason: "Test mode is disabled." };
  }

  if (message.channel.id !== rules.testChannelId) {
    return {
      ok: false as const,
      reason: "Test utilities are only available in the configured test channel.",
    };
  }

  if (!rules.testAdminUserIds.includes(message.author.id)) {
    return {
      ok: false as const,
      reason: "Test utilities are not enabled for you in this channel.",
    };
  }

  return { ok: true as const, rules };
};

const getActiveDbGame = async (channelId: string): Promise<ActiveDbGame | undefined> => {
  const rows = await sqlClient`
    SELECT
      g.id AS game_id,
      g.status,
      g.is_test,
      gm.discord_user_id AS game_master_discord_user_id,
      l.country_code,
      l.country_name,
      l.region_name,
      l.latitude,
      l.longitude,
      g.current_multiplier_final
    FROM game g
    JOIN channel c ON c.id = g.channel_id
    JOIN location l ON l.id = g.location_id
    JOIN player gm ON gm.id = g.game_master_player_id
    WHERE c.discord_channel_id = ${channelId}
      AND g.status = 'active'
    ORDER BY g.started_at DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    gameId: row.game_id,
    status: row.status,
    isTest: row.is_test,
    gameMasterDiscordUserId: row.game_master_discord_user_id,
    countryCode: row.country_code,
    countryName: row.country_name ?? undefined,
    regionName: row.region_name ?? undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    currentMultiplier: Number(row.current_multiplier_final),
  };
};

const getActiveContext = async (message: Message<true>) => {
  const state = await getActiveGameState(message.guild.id, message.channel.id);
  const dbGame = await getActiveDbGame(message.channel.id);
  return {
    state,
    dbGame,
    redisMissingButDbActive: !state && Boolean(dbGame),
  };
};

const cancelOrFailGame = async (
  message: Message<true>,
  status: "cancelled" | "failed",
  reason: string,
) => {
  const { state, dbGame } = await getActiveContext(message);
  const gameId = state?.gameId ?? dbGame?.gameId;
  if (!gameId) {
    await message.reply("No active game in this test channel.");
    return true;
  }

  const player = await upsertPlayer(message.author, message.member?.displayName);
  await sqlClient`
    UPDATE game
    SET
      status = ${status},
      ended_at = now(),
      cancel_reason = ${reason},
      cancelled_by_player_id = ${player.id},
      updated_at = now()
    WHERE id = ${gameId}
      AND status = 'active'
  `;

  await clearGameKeys(message.guild.id, message.channel.id, gameId);
  await removeMultiplierJobsForGame(gameId);
  await message.reply(
    status === "cancelled" ? `Cancelled test game ${gameId}.` : "Reset test game state.",
  );
  return true;
};

const statusCommand = async (message: Message<true>) => {
  const { state, dbGame, redisMissingButDbActive } = await getActiveContext(message);
  const wrongCountries = state ? await getWrongCountries(state.gameId) : [];
  const target = dbGame
    ? `${dbGame.countryCode} - ${dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode)}`
    : "None";

  await message.reply(
    [
      `Test mode: **enabled**`,
      `Test channel: **yes**`,
      `Caller admin: **yes**`,
      dbGame ? `Game: **${dbGame.gameId}** (${dbGame.status})` : "Game: **none**",
      dbGame ? `Game master: <@${dbGame.gameMasterDiscordUserId}>` : undefined,
      `Wrong countries: **${wrongCountries.length}**`,
      `Current multiplier: **${(state?.currentMultiplier ?? dbGame?.currentMultiplier ?? 1).toFixed(2)}x**`,
      `Test game: **${state?.isTest ?? dbGame?.isTest ?? false}**`,
      redisMissingButDbActive
        ? "Redis active state is missing, but an active database game exists."
        : undefined,
      dbGame ? `Target: **${target}**` : undefined,
      dbGame?.regionName ? `Region: **${dbGame.regionName}**` : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return true;
};

const revealCommand = async (message: Message<true>) => {
  const { dbGame, redisMissingButDbActive } = await getActiveContext(message);
  if (!dbGame) {
    await message.reply("No active game in this test channel.");
    return true;
  }

  await message.reply(
    [
      redisMissingButDbActive
        ? "Redis active state is missing, but an active database game exists."
        : undefined,
      `Answer: **${dbGame.countryCode} - ${dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode)}**`,
      dbGame.regionName ? `Region: **${dbGame.regionName}**` : undefined,
      `Coordinates: **${dbGame.latitude.toFixed(5)}, ${dbGame.longitude.toFixed(5)}**`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return true;
};

const tickCommand = async (message: Message<true>) => {
  const { state, dbGame } = await getActiveContext(message);
  const gameId = state?.gameId ?? dbGame?.gameId;
  if (!gameId) {
    await message.reply("No active game in this test channel.");
    return true;
  }

  const result = await runIdleMultiplierCheck(message.client, gameId, { force: true });
  if (result.status === "missing-game") {
    await message.reply("No active game in this test channel.");
    return true;
  }

  if (result.status === "capped") {
    await message.reply(
      `Current multiplier is already capped at ${result.currentMultiplier.toFixed(2)}x.`,
    );
    return true;
  }

  if (result.status === "increased") {
    await message.reply(
      `Forced multiplier tick: ${result.previousMultiplier.toFixed(2)}x -> ${result.newMultiplier.toFixed(2)}x.`,
    );
    return true;
  }

  await message.reply("Multiplier tick did not change the active game.");
  return true;
};

export const handleTestCommand = async (message: Message<true>, args: string[]) => {
  const auth = await authorize(message);
  if (!auth.ok) {
    return deny(message, auth.reason);
  }

  const subcommand = normalize(args[0] ?? "status");
  if (["status", "durum"].includes(subcommand)) {
    return statusCommand(message);
  }

  if (["cancel", "iptal"].includes(subcommand)) {
    const reason = args.slice(1).join(" ").trim() || "test cancel";
    return cancelOrFailGame(message, "cancelled", reason);
  }

  if (["reveal", "cevap"].includes(subcommand)) {
    return revealCommand(message);
  }

  if (["tick", "multiplier", "mult", "carpan", "çarpan"].includes(subcommand)) {
    return tickCommand(message);
  }

  if (["reset", "sifirla", "sıfırla"].includes(subcommand)) {
    return cancelOrFailGame(message, "failed", "test reset");
  }

  await message.reply(
    "Unknown test command. Use `!test status`, `cancel`, `reveal`, `tick`, or `reset`.",
  );
  return true;
};
