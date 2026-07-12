import type { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { loadRules } from "../config/rules.ts";
import {
  getActiveGameState,
  getCachedMap,
  getWrongCountries,
  mapHash,
  setCachedMap,
} from "../domain/game/active-game-state.ts";
import { formatPeriodStandingsMessage } from "../domain/awards/announce.ts";
import { getCurrentPeriodWindow, type PeriodType } from "../domain/awards/periods.ts";
import { renderMap } from "../domain/maps/map-renderer.ts";
import { viewportAliases } from "../domain/maps/region-presets.ts";
import { getLeaderboard, getPlayerProfile, upsertPlayer } from "../repositories/core-repository.ts";
import { getAllCategoryStandings, getMedalLeaderboard } from "../repositories/awards-repository.ts";
import {
  countPlayerUnlocksByDiscordId,
  getPlayerUnlocks,
} from "../repositories/achievements-repository.ts";
import { ACHIEVEMENT_CATALOG, ONESHOT_TIER } from "../domain/achievements/catalog.ts";
import {
  getHostStreak,
  getPlayStreak,
  getPlayerStatSnapshot,
} from "../domain/achievements/metrics.ts";
import { sqlClient } from "../db/client.ts";
import { handleTestCommand } from "./test-command.ts";
import { messages } from "../i18n/messages.ts";

const normalizeCommand = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

const periodCommandAliases: Record<string, PeriodType> = {
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

export const isCommandMessage = async (content: string) => {
  const rules = await loadRules();
  return rules.commandPrefixes.some((prefix) => content.startsWith(prefix));
};

const parseCommand = async (message: Message) => {
  const rules = await loadRules();
  const prefix = rules.commandPrefixes.find((candidate) => message.content.startsWith(candidate));
  if (!prefix) {
    return null;
  }

  const command = normalizeCommand(message.content.slice(prefix.length).split(/\s+/)[0] ?? "");
  if (!command) {
    return null;
  }
  const args = message.content.slice(prefix.length).trim().split(/\s+/).slice(1);
  return { rules, prefix, command, args };
};

const replyChunked = async (message: Message, lines: string[]) => {
  let chunk = "";
  for (const line of lines) {
    if (chunk.length + line.length + 1 > 1900) {
      await message.reply(chunk);
      chunk = line;
    } else {
      chunk = chunk ? `${chunk}\n${line}` : line;
    }
  }
  if (chunk) {
    await message.reply(chunk);
  }
};

/** Works in guild channels and DMs. */
export const handleAchievementsCommand = async (message: Message): Promise<boolean> => {
  const parsed = await parseCommand(message);
  if (!parsed) {
    return false;
  }
  const { command, args } = parsed;
  if (!["achievements", "basarim", "basarimlar"].includes(command)) {
    return false;
  }

  await sqlClient`
    INSERT INTO command_log (command, raw_message)
    VALUES (${command}, ${message.content})
  `;

  const sub = normalizeCommand(args[0] ?? "");
  if (sub === "list" || sub === "liste") {
    const owned = new Set<string>();
    try {
      const player = await upsertPlayer(message.author);
      const unlocks = await getPlayerUnlocks(player.id);
      for (const unlock of unlocks) {
        owned.add(unlock.achievementId);
      }
    } catch {
      // profile may not exist yet
    }

    const lines = [messages.achievements.listHeader];
    for (const item of ACHIEVEMENT_CATALOG) {
      const desc =
        item.hiddenUntilEarn && !owned.has(item.id)
          ? messages.achievements.hiddenDescription
          : messages.achievements.description(item.id);
      lines.push(`**${messages.achievements.name(item.id)}**: ${desc}`);
    }
    await replyChunked(message, lines);
    return true;
  }

  if (sub && sub !== "list" && sub !== "liste") {
    await message.reply(messages.achievements.usage);
    return true;
  }

  const player = await upsertPlayer(message.author);
  const unlocks = await getPlayerUnlocks(player.id);
  if (unlocks.length === 0) {
    await message.reply(messages.achievements.empty);
    return true;
  }

  const byId = new Map<string, number[]>();
  for (const unlock of unlocks) {
    const tiers = byId.get(unlock.achievementId) ?? [];
    if (unlock.tier !== ONESHOT_TIER) {
      tiers.push(unlock.tier);
    }
    byId.set(unlock.achievementId, tiers);
  }

  const stats = await getPlayerStatSnapshot(player.id);
  const hostStreak = await getHostStreak(player.id);
  const playStreak = await getPlayStreak(player.id);
  const lines = [messages.achievements.header];

  for (const item of ACHIEVEMENT_CATALOG) {
    if (!byId.has(item.id) && item.kind === "oneshot") {
      const ownedOneshot = unlocks.some(
        (u) => u.achievementId === item.id && u.tier === ONESHOT_TIER,
      );
      if (!ownedOneshot) {
        continue;
      }
      lines.push(`**${messages.achievements.name(item.id)}** ✓`);
      continue;
    }
    if (!byId.has(item.id) && item.kind === "ladder") {
      continue;
    }

    if (item.kind === "oneshot") {
      lines.push(`**${messages.achievements.name(item.id)}** ✓`);
      continue;
    }

    const earned = (byId.get(item.id) ?? []).sort((a, b) => a - b);
    const nextTier = item.tiers.find((tier) => !earned.includes(tier)) ?? null;
    let currentValue: number | string = "?";
    let streakCurrent: number | undefined;
    if (item.id === "host_games") currentValue = stats.gamesStarted;
    else if (item.id === "play_games") currentValue = stats.gamesParticipated;
    else if (item.id === "win_games") currentValue = stats.gamesWon;
    else if (item.id === "points_total") currentValue = stats.pointsTotal;
    else if (item.id === "host_streak_days") {
      currentValue = hostStreak.best;
      streakCurrent = hostStreak.current;
    } else if (item.id === "play_streak_days") {
      currentValue = playStreak.best;
      streakCurrent = playStreak.current;
    } else if (earned.length > 0) {
      currentValue = earned[earned.length - 1]!;
    }

    lines.push(
      messages.achievements.progressLine(item.id, earned, nextTier, currentValue, streakCurrent),
    );
  }

  await replyChunked(message, lines);
  return true;
};

export const handleCommand = async (message: Message<true>) => {
  const parsed = await parseCommand(message);
  if (!parsed) {
    return false;
  }
  const { rules, command, args } = parsed;

  if (["achievements", "basarim", "basarimlar"].includes(command)) {
    return handleAchievementsCommand(message);
  }

  await sqlClient`
    INSERT INTO command_log (command, raw_message)
    VALUES (${command}, ${message.content})
  `;

  if (command === "test") {
    return handleTestCommand(message, args);
  }

  const viewport = viewportAliases.get(command);
  if (viewport) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const wrongCountries = await getWrongCountries(state.gameId);
    const hash = mapHash(wrongCountries);
    const cached = await getCachedMap(state.gameId, viewport, hash);
    const map = cached
      ? {
          buffer: cached,
          filename: `${viewport}-guesses.png`,
        }
      : renderMap({ wrongCountries, viewport });
    if (!cached) {
      await setCachedMap(state.gameId, viewport, hash, map.buffer);
    }
    await message.channel.send({
      files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
    });
    return true;
  }

  if (["ss", "screenshot", "ekran"].includes(command)) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const response = await fetch(state.screenshotUrl);
    if (!response.ok) {
      await message.reply(messages.commands.couldNotLoadScreenshot);
      return true;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename =
      new URL(state.screenshotUrl).pathname.split("/").pop() ||
      messages.filenames.fallbackScreenshot;
    await message.channel.send({
      files: [new AttachmentBuilder(buffer, { name: filename })],
    });
    return true;
  }

  if (["profile", "profil"].includes(command)) {
    const profile = await getPlayerProfile(message.author.id);
    if (!profile) {
      await message.reply(messages.commands.noProfileYet);
      return true;
    }

    const participated = Number(profile.games_participated ?? 0);
    const wins = Number(profile.games_won ?? 0);
    const winRate = participated === 0 ? 0 : Math.round((wins / participated) * 100);
    await message.reply(
      messages.commands.profile({
        displayName: profile.display_name,
        points: profile.points_total ?? 0,
        wins,
        participated,
        winRate,
        gamesStarted: profile.games_started ?? 0,
        guesses: profile.total_guesses ?? 0,
        gmMultiplier: Number(profile.current_gm_multiplier ?? 1),
        medalPoints: Number(profile.medal_points ?? 0),
        gold: Number(profile.gold ?? 0),
        silver: Number(profile.silver ?? 0),
        bronze: Number(profile.bronze ?? 0),
        achievementsUnlocked: await countPlayerUnlocksByDiscordId(message.author.id),
      }),
    );
    return true;
  }

  const replyLeaderboard = async (kind: "points" | "wins" | "started" | "hardest") => {
    const rows = await getLeaderboard(kind);
    const lines = rows.map((row, index) =>
      messages.commands.leaderboardRow(index + 1, row.display_name, row.value),
    );
    await message.reply(lines.length > 0 ? lines.join("\n") : messages.commands.noLeaderboardData);
  };

  if (["hardest", "zor", "bestgm"].includes(command)) {
    await replyLeaderboard("hardest");
    return true;
  }

  if (["leaderboard", "liderlik", "top", "best"].includes(command)) {
    const arg = normalizeCommand(args[0] ?? "points");
    const kind =
      arg === "wins" || arg === "win"
        ? "wins"
        : arg === "started"
          ? "started"
          : arg === "hardest"
            ? "hardest"
            : "points";
    await replyLeaderboard(kind);
    return true;
  }

  const periodType = periodCommandAliases[command];
  if (periodType) {
    const window = getCurrentPeriodWindow(periodType);
    const standings = await getAllCategoryStandings(window.startsAt, window.endsAt, 10);
    await message.reply(formatPeriodStandingsMessage(window, standings, "live"));
    return true;
  }

  if (["medals", "awards", "madalya"].includes(command)) {
    const periodArg = normalizeCommand(args[0] ?? "");
    const medalsPeriodType = periodArg ? periodCommandAliases[periodArg] : undefined;
    if (!medalsPeriodType) {
      await message.reply(messages.awards.medalsUsage);
      return true;
    }

    const rows = await getMedalLeaderboard(medalsPeriodType);
    if (rows.length === 0) {
      await message.reply(messages.awards.noMedalData);
      return true;
    }

    const lines = [
      messages.awards.medalsHeader(medalsPeriodType),
      ...rows.map((row, index) =>
        messages.awards.medalRow({
          rank: index + 1,
          displayName: row.displayName,
          medalPoints: row.medalPoints,
          gold: row.gold,
          silver: row.silver,
          bronze: row.bronze,
        }),
      ),
    ];
    await message.reply(lines.join("\n"));
    return true;
  }

  if (["stats", "istatistik"].includes(command)) {
    const rows = await sqlClient`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_games,
        COUNT(*) AS total_games,
        COALESCE(SUM(total_guess_count), 0) AS total_guesses
      FROM game
    `;
    const row = rows[0];
    await message.reply(
      messages.commands.stats({
        completedGames: row?.completed_games ?? 0,
        totalGames: row?.total_games ?? 0,
        totalGuesses: row?.total_guesses ?? 0,
      }),
    );
    return true;
  }

  if (["help", "yardim"].includes(command)) {
    const isTestAdmin =
      rules.testModeEnabled &&
      rules.testChannelId === message.channel.id &&
      rules.testAdminUserIds.includes(message.author.id);
    await message.reply(
      [messages.commands.helpCommands, isTestAdmin ? messages.commands.helpTestCommands : undefined]
        .filter(Boolean)
        .join("\n"),
    );
    return true;
  }

  return false;
};
