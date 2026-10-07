import type { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { isTestChannel, loadRules } from "../config/rules.ts";
import {
  gameModeOf,
  getActiveGameState,
  getCachedMap,
  getWrongCountries,
  mapHash,
  setCachedMap,
  updateGameState,
} from "../domain/game/active-game-state.ts";
import { modeForChannel, tablesFor, takeModeArg, type GameMode } from "../domain/game/game-mode.ts";
import { renderProvinceMap, TURKEY_MAP_VIEWPORT } from "../domain/maps/province-map-renderer.ts";
import { getProvinceName } from "../domain/provinces/normalize-province-guess.ts";
import { loadGameScreenshot } from "../domain/game/load-screenshot.ts";
import { prepareGameScreenshot } from "../domain/game/prepare-screenshot.ts";
import { logger } from "../util/logger.ts";
import { formatPeriodStandingsMessage } from "../domain/awards/announce.ts";
import {
  ALL_TIME_ALIASES,
  getCurrentPeriodWindow,
  PERIOD_ALIASES,
} from "../domain/awards/periods.ts";
import { renderMap } from "../domain/maps/map-renderer.ts";
import { viewportAliases } from "../domain/maps/region-presets.ts";
import { getLeaderboard, getPlayerProfile, upsertPlayer } from "../repositories/core-repository.ts";
import { getAllCategoryStandings, getMedalLeaderboard } from "../repositories/awards-repository.ts";
import { getPlayerUnlocks } from "../repositories/achievements-repository.ts";
import { catalogForMode, ONESHOT_TIER } from "../domain/achievements/catalog.ts";
import {
  getHostStreak,
  getPlayStreak,
  getPlayerStatSnapshot,
} from "../domain/achievements/metrics.ts";
import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { sqlClient } from "../db/client.ts";
import { handleTestCommand } from "./test-command.ts";
import { messages } from "../i18n/messages.ts";
import { formatPlayerProfile } from "./player-profile.ts";
import { getPlayerMapHistory } from "../repositories/player-map-repository.ts";
import { renderPlayerMap } from "../domain/maps/player-map-renderer.ts";

const normalizeCommand = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

export const isCommandMessage = async (content: string) => {
  const rules = await loadRules();
  return rules.commandPrefixes.some((prefix) => content.startsWith(prefix));
};

/** Extra map commands for province games. Any country map command also shows Türkiye there. */
const PROVINCE_MAP_COMMANDS = new Set(["turkiye", "turkey", "tr"]);

/** Mode for stats commands: an explicit `il` / `ülke` word wins, then the channel. */
const resolveCommandMode = async (message: Message, args: string[]) => {
  const { mode, rest } = takeModeArg(args);
  if (mode) {
    return { mode, args: rest };
  }
  const channelMode = message.inGuild()
    ? modeForChannel(await loadRules(), message.channel.id)
    : undefined;
  return { mode: channelMode ?? ("country" as GameMode), args: rest };
};

/** Province replies start with the province label. Country replies are unchanged. */
const withModeLabel = (mode: GameMode, text: string) =>
  mode === "province" ? `${messages.province.label}\n${text}` : text;

const getGameScreenshotMessageId = async (gameId: string, mode: GameMode) => {
  const rows = await sqlClient`
    SELECT screenshot_message_id
    FROM ${sqlClient(tablesFor(mode).game)}
    WHERE id = ${gameId}
  `;
  const messageId = rows[0]?.screenshot_message_id;
  return typeof messageId === "string" && messageId.length > 0 ? messageId : undefined;
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

const getProvinceGameStats = async () => {
  const rows = await sqlClient`
    WITH completed AS (
      SELECT *
      FROM province_game
      WHERE status = 'completed'
    ),
    province_counts AS (
      SELECT target_province_code AS province_code, COUNT(*)::int AS games
      FROM completed
      GROUP BY 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM completed) AS completed_games,
      COALESCE(SUM(total_guess_count), 0)::int AS total_guesses,
      (
        SELECT COUNT(*)::int
        FROM province_player_stat
        WHERE games_started > 0 OR total_guesses > 0
      ) AS total_players,
      (SELECT COUNT(*)::int FROM province_counts) AS distinct_provinces,
      (
        SELECT province_code
        FROM province_counts
        ORDER BY games DESC, province_code ASC
        LIMIT 1
      ) AS top_province_code,
      (
        SELECT games
        FROM province_counts
        ORDER BY games DESC, province_code ASC
        LIMIT 1
      ) AS top_province_games,
      (
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY solve_seconds)
        FROM (
          SELECT EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          )) AS solve_seconds
          FROM completed g
          JOIN province_guess wg ON wg.id = g.winning_guess_id
        ) solves
        WHERE solve_seconds >= 0
      ) AS median_solve_seconds,
      (
        SELECT COUNT(*)::int
        FROM completed
        WHERE unique_wrong_province_count = 0
      ) AS oneshot_games,
      (
        SELECT COUNT(DISTINCT game_master_player_id)::int
        FROM completed
      ) AS hosts,
      (
        SELECT COUNT(*)::int
        FROM (
          SELECT g.id, gs.player_id
          FROM completed g
          JOIN province_guess gs ON gs.game_id = g.id
          WHERE gs.is_rate_limited = false
          GROUP BY g.id, gs.player_id
        ) participants
      ) AS participations
    FROM province_game
  `;
  const row = rows[0];
  const medianRaw = row?.median_solve_seconds;
  const medianSolveSeconds = medianRaw == null ? null : Number(medianRaw);
  const topProvinceCode = row?.top_province_code == null ? null : String(row.top_province_code);
  return {
    completedGames: row?.completed_games ?? 0,
    totalGuesses: row?.total_guesses ?? 0,
    totalPlayers: row?.total_players ?? 0,
    distinctProvinces: row?.distinct_provinces ?? 0,
    topProvinceName: topProvinceCode == null ? null : getProvinceName(topProvinceCode),
    topProvinceGames: row?.top_province_games ?? 0,
    medianSolveSeconds: Number.isFinite(medianSolveSeconds) ? medianSolveSeconds : null,
    oneshotGames: row?.oneshot_games ?? 0,
    hosts: row?.hosts ?? 0,
    participations: row?.participations ?? 0,
  };
};

/** Works in guild channels and DMs. */
export const handlePlayerMapCommand = async (message: Message): Promise<boolean> => {
  const parsed = await parseCommand(message);
  if (!parsed || !["winmap", "startmap"].includes(parsed.command)) {
    return false;
  }
  const { mode, args } = await resolveCommandMode(message, parsed.args);
  await sqlClient`
    INSERT INTO command_log (command, raw_message)
    VALUES (${parsed.command}, ${message.content})
  `;
  if (args.length > 0) {
    await message.reply(messages.playerMap.usage);
    return true;
  }

  const kind = parsed.command === "winmap" ? "wins" : "starts";
  const [history, profile] = await Promise.all([
    getPlayerMapHistory(message.author.id, kind, mode),
    getPlayerProfile(message.author.id, mode),
  ]);
  const map = renderPlayerMap({
    kind,
    mode,
    playerName:
      message.member?.displayName ?? message.author.displayName ?? message.author.username,
    medals: {
      gold: Number(profile?.gold ?? 0),
      silver: Number(profile?.silver ?? 0),
      bronze: Number(profile?.bronze ?? 0),
    },
    ...history,
  });
  await message.reply({
    files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
    allowedMentions: { repliedUser: false },
  });
  return true;
};

/** Works in guild channels and DMs. */
export const handleAchievementsCommand = async (message: Message): Promise<boolean> => {
  const parsed = await parseCommand(message);
  if (!parsed) {
    return false;
  }
  const { command } = parsed;
  if (!["achievements", "basarim", "basarimlar"].includes(command)) {
    return false;
  }
  const { mode, args } = await resolveCommandMode(message, parsed.args);
  const catalog = catalogForMode(mode);

  await sqlClient`
    INSERT INTO command_log (command, raw_message)
    VALUES (${command}, ${message.content})
  `;

  const sub = normalizeCommand(args[0] ?? "");
  if (sub === "list" || sub === "liste") {
    const owned = new Set<string>();
    try {
      const player = await upsertPlayer(message.author);
      const unlocks = await getPlayerUnlocks(player.id, mode);
      for (const unlock of unlocks) {
        owned.add(unlock.achievementId);
      }
    } catch {
      // profile may not exist yet
    }

    const lines = [withModeLabel(mode, messages.achievements.listHeader)];
    for (const item of catalog) {
      const desc =
        item.hiddenUntilEarn && !owned.has(item.id)
          ? messages.achievements.hiddenDescription
          : messages.achievements.description(item.id, mode);
      lines.push(`**${messages.achievements.name(item.id, mode)}**: ${desc}`);
    }
    await replyChunked(message, lines);
    return true;
  }

  if (sub && sub !== "list" && sub !== "liste") {
    await message.reply(messages.achievements.usage);
    return true;
  }

  const player = await upsertPlayer(message.author);
  const unlocks = await getPlayerUnlocks(player.id, mode);
  if (unlocks.length === 0) {
    await message.reply(withModeLabel(mode, messages.achievements.empty));
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

  const stats = await getPlayerStatSnapshot(player.id, mode);
  const hostStreak = await getHostStreak(player.id, new Date(), mode);
  const playStreak = await getPlayStreak(player.id, new Date(), mode);
  const lines = [withModeLabel(mode, messages.achievements.header)];

  for (const item of catalog) {
    if (!byId.has(item.id) && item.kind === "oneshot") {
      const ownedOneshot = unlocks.some(
        (u) => u.achievementId === item.id && u.tier === ONESHOT_TIER,
      );
      if (!ownedOneshot) {
        continue;
      }
      lines.push(`**${messages.achievements.name(item.id, mode)}** ✓`);
      continue;
    }
    if (!byId.has(item.id) && item.kind === "ladder") {
      continue;
    }

    if (item.kind === "oneshot") {
      lines.push(`**${messages.achievements.name(item.id, mode)}** ✓`);
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
      messages.achievements.progressLine(
        item.id,
        earned,
        nextTier,
        currentValue,
        streakCurrent,
        mode,
      ),
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
  const { mode, args: statArgs } = await resolveCommandMode(message, args);

  if (["winmap", "startmap"].includes(command)) {
    return handlePlayerMapCommand(message);
  }

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

  if (viewportAliases.has(command) || PROVINCE_MAP_COMMANDS.has(command)) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const wrongCountries = await getWrongCountries(state.gameId);
    if (gameModeOf(state) === "province") {
      const hash = mapHash(wrongCountries);
      const cached = await getCachedMap(state.gameId, TURKEY_MAP_VIEWPORT, hash);
      const map = cached
        ? { buffer: cached, filename: messages.filenames.turkeyGuesses }
        : renderProvinceMap({ wrongProvinces: wrongCountries });
      await Promise.all([
        message.channel.send({
          files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
        }),
        cached ? undefined : setCachedMap(state.gameId, TURKEY_MAP_VIEWPORT, hash, map.buffer),
      ]);
      return true;
    }

    const viewport = viewportAliases.get(command) ?? "world";
    const hash = mapHash(wrongCountries);
    const cached = await getCachedMap(state.gameId, viewport, hash);
    const map = cached
      ? {
          buffer: cached,
          filename: `${viewport}-guesses.png`,
        }
      : renderMap({ wrongCountries, viewport });
    const send = message.channel.send({
      files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
    });
    await Promise.all([
      send,
      cached ? undefined : setCachedMap(state.gameId, viewport, hash, map.buffer),
    ]);
    return true;
  }

  if (["ss", "screenshot", "ekran"].includes(command)) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const screenshotMessageId =
      state.screenshotMessageId ??
      (await getGameScreenshotMessageId(state.gameId, gameModeOf(state)));
    const loaded = await loadGameScreenshot({
      screenshotUrl: state.screenshotUrl,
      fallbackName: messages.filenames.fallbackScreenshot,
      refreshUrl: screenshotMessageId
        ? async () => {
            const original = await message.channel.messages
              .fetch(screenshotMessageId)
              .catch(() => null);
            const attachment = original?.attachments.first();
            if (!attachment) {
              return undefined;
            }
            return { url: attachment.url, name: attachment.name ?? undefined };
          }
        : undefined,
    });
    if (!loaded) {
      await message.reply(messages.commands.couldNotLoadScreenshot);
      return true;
    }

    const screenshot = await prepareGameScreenshot(
      loaded.buffer,
      loaded.filename,
      rules.fairPlayNoticeEnabled ? messages.fairPlay.footer : undefined,
    );
    if (!screenshot) {
      await message.reply(messages.commands.couldNotLoadScreenshot);
      return true;
    }

    const urlChanged = loaded.url !== state.screenshotUrl;
    if (urlChanged || (screenshotMessageId && state.screenshotMessageId !== screenshotMessageId)) {
      state.screenshotUrl = loaded.url;
      if (screenshotMessageId) {
        state.screenshotMessageId = screenshotMessageId;
      }
      await updateGameState(state);
      if (urlChanged) {
        await sqlClient`
          UPDATE ${sqlClient(tablesFor(gameModeOf(state)).game)}
          SET screenshot_url = ${loaded.url}, updated_at = now()
          WHERE id = ${state.gameId}
        `;
        logger.info("Refreshed Discord screenshot URL after CDN expiry", {
          gameId: state.gameId,
        });
      }
    }

    await message.channel.send({
      files: [new AttachmentBuilder(screenshot.buffer, { name: screenshot.name })],
    });
    return true;
  }

  if (["profile", "profil"].includes(command)) {
    const profile = await formatPlayerProfile(message.author.id, mode);
    await message.reply(profile ? withModeLabel(mode, profile) : messages.commands.noProfileYet);
    return true;
  }

  const replyLeaderboard = async (kind: "points" | "wins" | "started" | "hardest") => {
    const rows = await getLeaderboard(kind, 10, mode);
    const lines = rows.map((row, index) =>
      messages.commands.leaderboardRow(index + 1, row.display_name, row.value),
    );
    await message.reply(
      withModeLabel(
        mode,
        lines.length > 0 ? lines.join("\n") : messages.commands.noLeaderboardData,
      ),
    );
  };

  if (["hardest", "zor", "bestgm"].includes(command)) {
    await replyLeaderboard("hardest");
    return true;
  }

  if (["leaderboard", "liderlik", "top", "best"].includes(command)) {
    const arg = normalizeCommand(statArgs[0] ?? "points");
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

  const periodType = PERIOD_ALIASES[command];
  if (periodType) {
    const window = getCurrentPeriodWindow(periodType);
    const standings = await getAllCategoryStandings(window.startsAt, window.endsAt, 10, mode);
    await message.reply(formatPeriodStandingsMessage(window, standings, "live", mode));
    return true;
  }

  if (["medals", "awards", "madalya", "madalyalar"].includes(command)) {
    const periodArg = normalizeCommand(statArgs[0] ?? "");
    const allTime = !periodArg || ALL_TIME_ALIASES.has(periodArg);
    const medalsPeriodType = allTime ? undefined : PERIOD_ALIASES[periodArg];
    if (!allTime && !medalsPeriodType) {
      await message.reply(messages.awards.medalsUsage);
      return true;
    }

    const rows = await getMedalLeaderboard(medalsPeriodType, 10, mode);
    if (rows.length === 0) {
      await message.reply(withModeLabel(mode, messages.awards.noMedalData));
      return true;
    }

    const lines = [
      withModeLabel(mode, messages.awards.medalsHeader(medalsPeriodType)),
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

  if (["stats", "istatistik"].includes(command) && mode === "province") {
    await message.reply(messages.province.stats(await getProvinceGameStats()));
    return true;
  }

  if (["stats", "istatistik"].includes(command)) {
    const rows = await sqlClient`
      WITH completed AS (
        SELECT *
        FROM game
        WHERE status = 'completed'
      ),
      country_counts AS (
        SELECT
          COALESCE(l.manual_country_code, l.country_code) AS country_code,
          COUNT(*)::int AS games
        FROM completed g
        JOIN location l ON l.id = g.location_id
        GROUP BY 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM completed) AS completed_games,
        COALESCE(SUM(total_guess_count), 0)::int AS total_guesses,
        (SELECT COUNT(*)::int FROM player) AS total_players,
        (SELECT COUNT(*)::int FROM country_counts) AS distinct_countries,
        (
          SELECT country_code
          FROM country_counts
          ORDER BY games DESC, country_code ASC
          LIMIT 1
        ) AS top_country_code,
        (
          SELECT games
          FROM country_counts
          ORDER BY games DESC, country_code ASC
          LIMIT 1
        ) AS top_country_games,
        (
          SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY solve_seconds)
          FROM (
            SELECT EXTRACT(EPOCH FROM (
              COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
            )) AS solve_seconds
            FROM completed g
            JOIN guess wg ON wg.id = g.winning_guess_id
          ) solves
          WHERE solve_seconds >= 0
        ) AS median_solve_seconds,
        (
          SELECT COUNT(*)::int
          FROM completed
          WHERE unique_wrong_country_count = 0
        ) AS oneshot_games,
        (
          SELECT COUNT(DISTINCT game_master_player_id)::int
          FROM completed
        ) AS hosts,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT g.id, gs.player_id
            FROM completed g
            JOIN guess gs ON gs.game_id = g.id
            WHERE gs.is_rate_limited = false
            GROUP BY g.id, gs.player_id
          ) participants
        ) AS participations
      FROM game
    `;
    const row = rows[0];
    const medianRaw = row?.median_solve_seconds;
    const medianSolveSeconds = medianRaw == null ? null : Number(medianRaw);
    const topCountryCode = row?.top_country_code == null ? null : String(row.top_country_code);
    await message.reply(
      messages.commands.stats({
        completedGames: row?.completed_games ?? 0,
        totalGuesses: row?.total_guesses ?? 0,
        totalPlayers: row?.total_players ?? 0,
        distinctCountries: row?.distinct_countries ?? 0,
        topCountryName:
          topCountryCode == null ? null : getCountryDisplayName(topCountryCode, messages.locale),
        topCountryGames: row?.top_country_games ?? 0,
        medianSolveSeconds: Number.isFinite(medianSolveSeconds) ? medianSolveSeconds : null,
        oneshotGames: row?.oneshot_games ?? 0,
        hosts: row?.hosts ?? 0,
        participations: row?.participations ?? 0,
      }),
    );
    return true;
  }

  if (["help", "yardim"].includes(command)) {
    const isTestAdmin =
      isTestChannel(message.channel.id, rules) &&
      rules.testAdminUserIds.includes(message.author.id);
    await message.reply(
      [
        mode === "province" ? messages.province.helpCommands : messages.commands.helpCommands,
        isTestAdmin ? messages.commands.helpTestCommands : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return true;
  }

  return false;
};
