import { sqlClient } from "../../db/client.ts";
import { getIstanbulParts } from "../awards/periods.ts";
import { CONTINENTS, continentForCountry, isTerritoryCountry } from "./geography.ts";

export type StreakInfo = {
  best: number;
  current: number;
};

const toIstanbulDateKey = (date: Date) => {
  const { year, month, day } = getIstanbulParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const streakFromSortedUniqueDays = (dayKeys: string[], todayKey: string): StreakInfo => {
  if (dayKeys.length === 0) {
    return { best: 0, current: 0 };
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(`${dayKeys[i - 1]}T12:00:00.000Z`);
    const curr = new Date(`${dayKeys[i]}T12:00:00.000Z`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  if (dayKeys.includes(todayKey)) {
    current = 1;
    let cursor = todayKey;
    while (true) {
      const parts = cursor.split("-").map(Number);
      const y = parts[0]!;
      const m = parts[1]!;
      const d = parts[2]!;
      const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
      const prevKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevDate.getUTCDate()).padStart(2, "0")}`;
      if (!dayKeys.includes(prevKey)) {
        break;
      }
      current += 1;
      cursor = prevKey;
    }
  } else {
    // Allow "yesterday" as still-current if today has no activity yet
    const todayParts = todayKey.split("-").map(Number);
    const y = todayParts[0]!;
    const m = todayParts[1]!;
    const d = todayParts[2]!;
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
    const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
    if (dayKeys.includes(yesterdayKey)) {
      current = 1;
      let cursor = yesterdayKey;
      while (true) {
        const parts = cursor.split("-").map(Number);
        const py = parts[0]!;
        const pm = parts[1]!;
        const pd = parts[2]!;
        const prevDate = new Date(Date.UTC(py, pm - 1, pd - 1));
        const prevKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevDate.getUTCDate()).padStart(2, "0")}`;
        if (!dayKeys.includes(prevKey)) {
          break;
        }
        current += 1;
        cursor = prevKey;
      }
    }
  }

  return { best: Math.max(best, current), current };
};

export const computeStreakFromDates = (dates: Date[], now = new Date()): StreakInfo => {
  const keys = [...new Set(dates.map(toIstanbulDateKey))].sort();
  return streakFromSortedUniqueDays(keys, toIstanbulDateKey(now));
};

export const getPlayerStatSnapshot = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT
      COALESCE(games_started, 0)::int AS games_started,
      COALESCE(games_participated, 0)::int AS games_participated,
      COALESCE(games_won, 0)::int AS games_won,
      COALESCE(total_guesses, 0)::int AS total_guesses,
      COALESCE(points_total, 0)::int AS points_total,
      COALESCE(best_single_game_points, 0)::int AS best_single_game_points,
      COALESCE(max_game_wrong_guess_count_as_gm, 0)::int AS max_game_wrong_guess_count_as_gm
    FROM player_stat
    WHERE player_id = ${playerId}
  `;
  const row = rows[0];
  return {
    gamesStarted: Number(row?.games_started ?? 0),
    gamesParticipated: Number(row?.games_participated ?? 0),
    gamesWon: Number(row?.games_won ?? 0),
    totalGuesses: Number(row?.total_guesses ?? 0),
    pointsTotal: Number(row?.points_total ?? 0),
    bestSingleGamePoints: Number(row?.best_single_game_points ?? 0),
    maxGameWrongAsGm: Number(row?.max_game_wrong_guess_count_as_gm ?? 0),
  };
};

export const getGmMilestoneCount = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM game_master_milestone
    WHERE player_id = ${playerId}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getMaxHostedCrowd = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COALESCE(MAX(crowd), 0)::int AS value
    FROM (
      SELECT COUNT(DISTINCT pg.player_id) AS crowd
      FROM game g
      JOIN player_game pg ON pg.game_id = g.id
      WHERE g.game_master_player_id = ${playerId}
        AND g.is_test = false
        AND g.status = 'completed'
      GROUP BY g.id
    ) crowds
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getMaxHostedMultiplierHundredths = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COALESCE(MAX(current_multiplier_final), 0) AS value
    FROM game
    WHERE game_master_player_id = ${playerId}
      AND is_test = false
      AND status = 'completed'
  `;
  return Math.round(Number(rows[0]?.value ?? 0) * 100);
};

export const getHostedCountryCount = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COUNT(DISTINCT l.country_code)::int AS value
    FROM game g
    JOIN location l ON l.id = g.location_id
    WHERE g.game_master_player_id = ${playerId}
      AND g.is_test = false
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getHostStartDates = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT started_at
    FROM game
    WHERE game_master_player_id = ${playerId}
      AND is_test = false
  `;
  return rows.map((row) => new Date(row.started_at as string | Date));
};

export const getParticipationDates = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COALESCE(pg.first_guess_at, g.started_at) AS activity_at
    FROM player_game pg
    JOIN game g ON g.id = pg.game_id
    WHERE pg.player_id = ${playerId}
      AND pg.role = 'player'
      AND g.is_test = false
  `;
  return rows.map((row) => new Date(row.activity_at as string | Date));
};

export const getHostStreak = async (playerId: string, now = new Date()) =>
  computeStreakFromDates(await getHostStartDates(playerId), now);

export const getPlayStreak = async (playerId: string, now = new Date()) =>
  computeStreakFromDates(await getParticipationDates(playerId), now);

export const getGoldMedalCount = async (playerId: string, periodType: string) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM period_award pa
    JOIN award_period ap ON ap.id = pa.award_period_id
    WHERE pa.player_id = ${playerId}
      AND pa.medal = 'gold'
      AND ap.period_type = ${periodType}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getWonCountryCodes = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT DISTINCT l.country_code
    FROM game g
    JOIN location l ON l.id = g.location_id
    WHERE g.winner_player_id = ${playerId}
      AND g.is_test = false
      AND g.status = 'completed'
  `;
  return rows.map((row) => String(row.country_code));
};

export const getMaxWinsSameCountry = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT l.country_code, COUNT(*)::int AS wins
    FROM game g
    JOIN location l ON l.id = g.location_id
    WHERE g.winner_player_id = ${playerId}
      AND g.is_test = false
      AND g.status = 'completed'
    GROUP BY l.country_code
    ORDER BY wins DESC
    LIMIT 1
  `;
  return {
    wins: Number(rows[0]?.wins ?? 0),
    countryCode: rows[0]?.country_code ? String(rows[0].country_code) : undefined,
  };
};

export const getTerritoryWinCount = async (playerId: string) => {
  const codes = await getWonCountryCodes(playerId);
  return codes.filter((code) => isTerritoryCountry(code)).length;
};

export const hasContinentTour = async (playerId: string) => {
  const codes = await getWonCountryCodes(playerId);
  const found = new Set(codes.map(continentForCountry).filter(Boolean));
  return CONTINENTS.every((continent) => found.has(continent));
};

export const getClutchWinMax = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COALESCE(MAX(unique_wrong_country_count), 0)::int AS value
    FROM game
    WHERE winner_player_id = ${playerId}
      AND is_test = false
      AND status = 'completed'
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getComebackWinMax = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COALESCE(MAX(pg.unique_wrong_guess_count), 0)::int AS value
    FROM player_game pg
    JOIN game g ON g.id = pg.game_id
    WHERE pg.player_id = ${playerId}
      AND pg.role = 'player'
      AND g.winner_player_id = ${playerId}
      AND g.is_test = false
      AND g.status = 'completed'
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getFirstBloodCount = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM (
      SELECT g.id
      FROM game g
      WHERE g.is_test = false
        AND g.status = 'completed'
        AND g.unique_wrong_country_count >= 50
        AND (
          SELECT gu.player_id
          FROM guess gu
          WHERE gu.game_id = g.id
            AND gu.is_correct = false
            AND gu.is_repeat = false
            AND gu.is_rate_limited = false
          ORDER BY gu.created_at ASC
          LIMIT 1
        ) = ${playerId}
    ) first_bloods
  `;
  return Number(rows[0]?.value ?? 0);
};

export const wasPatientZero = async (playerId: string, gameId: string) => {
  const rows = await sqlClient`
    SELECT
      g.unique_wrong_country_count,
      (
        SELECT gu.player_id
        FROM guess gu
        WHERE gu.game_id = g.id
          AND gu.is_correct = false
          AND gu.is_repeat = false
          AND gu.is_rate_limited = false
        ORDER BY gu.created_at ASC
        LIMIT 1
      ) AS first_wrong_player_id
    FROM game g
    WHERE g.id = ${gameId}
      AND g.is_test = false
      AND g.status = 'completed'
  `;
  const row = rows[0];
  return (
    Number(row?.unique_wrong_country_count ?? 0) >= 100 && row?.first_wrong_player_id === playerId
  );
};

export const getGameParticipantIds = async (gameId: string) => {
  const rows = await sqlClient`
    SELECT DISTINCT player_id
    FROM player_game
    WHERE game_id = ${gameId}
  `;
  return rows.map((row) => String(row.player_id));
};

export const getPlayerDiscordUserId = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT discord_user_id, display_name
    FROM player
    WHERE id = ${playerId}
  `;
  return rows[0]
    ? {
        discordUserId: String(rows[0].discord_user_id),
        displayName: String(rows[0].display_name),
      }
    : undefined;
};
