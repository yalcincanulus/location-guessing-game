import { faker } from "@faker-js/faker";
import type { PeriodType } from "../../src/domain/awards/periods.ts";
import { MEDAL_POINTS } from "../../src/domain/awards/periods.ts";
import { sqlClient } from "../../src/db/client.ts";
import { SIM_DISCORD_PREFIX, SIM_LOCATION_URL_PREFIX, SIM_PERIOD_KEY_PREFIX } from "./cleanup.ts";

export type SimPlayer = {
  id: string;
  discordUserId: string;
  displayName: string;
};

export type PlayerStatPatch = {
  gamesStarted?: number;
  gamesParticipated?: number;
  gamesWon?: number;
  totalGuesses?: number;
  correctGuesses?: number;
  wrongGuesses?: number;
  pointsTotal?: number;
  bestSingleGamePoints?: number;
  maxGameWrongGuessCountAsGm?: number;
};

export type CreateCompletedGameInput = {
  gameMasterPlayerId: string;
  winnerPlayerId: string;
  countryCode?: string;
  uniqueWrongCountryCount?: number;
  currentMultiplierFinal?: number;
  startedAt?: Date;
  endedAt?: Date;
  participantPlayerIds?: string[];
  /** Per-participant unique wrong guesses (for comeback). Winner defaults included. */
  winnerUniqueWrongGuessCount?: number;
  screenshotUrl?: string;
};

let simCounter = 0;

const nextSimId = () => {
  simCounter += 1;
  return `${SIM_DISCORD_PREFIX}${Date.now()}_${simCounter}_${faker.string.alphanumeric(6)}`;
};

export const createSimPlayer = async (displayName?: string): Promise<SimPlayer> => {
  const discordUserId = nextSimId();
  const name = displayName ?? faker.person.firstName();
  const rows = await sqlClient`
    INSERT INTO player (discord_user_id, display_name, last_seen_at, updated_at)
    VALUES (${discordUserId}, ${name}, now(), now())
    RETURNING id, discord_user_id, display_name
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create sim player");
  }
  await sqlClient`
    INSERT INTO player_stat (player_id)
    VALUES (${row.id})
    ON CONFLICT (player_id) DO NOTHING
  `;
  return {
    id: String(row.id),
    discordUserId: String(row.discord_user_id),
    displayName: String(row.display_name),
  };
};

export const setPlayerStats = async (playerId: string, patch: PlayerStatPatch) => {
  await sqlClient`
    UPDATE player_stat SET
      games_started = COALESCE(${patch.gamesStarted ?? null}, games_started),
      games_participated = COALESCE(${patch.gamesParticipated ?? null}, games_participated),
      games_won = COALESCE(${patch.gamesWon ?? null}, games_won),
      total_guesses = COALESCE(${patch.totalGuesses ?? null}, total_guesses),
      correct_guesses = COALESCE(${patch.correctGuesses ?? null}, correct_guesses),
      wrong_guesses = COALESCE(${patch.wrongGuesses ?? null}, wrong_guesses),
      points_total = COALESCE(${patch.pointsTotal ?? null}, points_total),
      best_single_game_points = COALESCE(${patch.bestSingleGamePoints ?? null}, best_single_game_points),
      max_game_wrong_guess_count_as_gm = COALESCE(${patch.maxGameWrongGuessCountAsGm ?? null}, max_game_wrong_guess_count_as_gm),
      updated_at = now()
    WHERE player_id = ${playerId}
  `;
};

export const createLocation = async (countryCode = "TR") => {
  const url = `${SIM_LOCATION_URL_PREFIX}${faker.string.uuid()}`;
  const rows = await sqlClient`
    INSERT INTO location (
      original_google_maps_url,
      latitude,
      longitude,
      coordinate_source,
      country_code,
      country_name
    )
    VALUES (
      ${url},
      ${faker.location.latitude()},
      ${faker.location.longitude()},
      'sim',
      ${countryCode.toUpperCase()},
      ${countryCode.toUpperCase()}
    )
    RETURNING id, country_code
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create sim location");
  }
  return { id: String(row.id), countryCode: String(row.country_code) };
};

export const createCompletedGame = async (input: CreateCompletedGameInput) => {
  const location = await createLocation(input.countryCode ?? "TR");
  const startedAt = input.startedAt ?? new Date();
  const endedAt = input.endedAt ?? startedAt;
  const uniqueWrong = input.uniqueWrongCountryCount ?? 0;
  const multiplier = input.currentMultiplierFinal ?? 1;
  const screenshotUrl = input.screenshotUrl ?? `${SIM_LOCATION_URL_PREFIX}shot.png`;

  const gameRows = await sqlClient`
    INSERT INTO game (
      game_master_player_id,
      location_id,
      status,
      screenshot_url,
      started_at,
      ended_at,
      winner_player_id,
      unique_wrong_country_count,
      wrong_guess_count,
      total_guess_count,
      current_multiplier_final,
      is_test
    )
    VALUES (
      ${input.gameMasterPlayerId},
      ${location.id},
      'completed',
      ${screenshotUrl},
      ${startedAt.toISOString()},
      ${endedAt.toISOString()},
      ${input.winnerPlayerId},
      ${uniqueWrong},
      ${uniqueWrong},
      ${uniqueWrong + 1},
      ${multiplier},
      false
    )
    RETURNING id
  `;
  const gameId = String(gameRows[0]?.id);
  if (!gameId) {
    throw new Error("Failed to create sim game");
  }

  await sqlClient`
    INSERT INTO player_game (player_id, game_id, role, guess_count)
    VALUES (${input.gameMasterPlayerId}, ${gameId}, 'game_master', 0)
    ON CONFLICT DO NOTHING
  `;

  const participantIds = new Set(input.participantPlayerIds ?? []);
  participantIds.add(input.winnerPlayerId);

  for (const playerId of participantIds) {
    const uniqueWrongGuesses =
      playerId === input.winnerPlayerId ? (input.winnerUniqueWrongGuessCount ?? 0) : 0;
    const firstGuessAt = startedAt;
    await sqlClient`
      INSERT INTO player_game (
        player_id,
        game_id,
        role,
        guess_count,
        unique_wrong_guess_count,
        first_guess_at,
        last_guess_at
      )
      VALUES (
        ${playerId},
        ${gameId},
        'player',
        ${uniqueWrongGuesses + (playerId === input.winnerPlayerId ? 1 : 1)},
        ${uniqueWrongGuesses},
        ${firstGuessAt.toISOString()},
        ${endedAt.toISOString()}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  return { gameId, locationId: location.id, countryCode: location.countryCode };
};

/** Host N games on given started_at dates (completed), distinct countries cycling. */
export const addHostGamesOnDays = async (
  hostPlayerId: string,
  winnerPlayerId: string,
  dates: Date[],
  countryCodes?: string[],
) => {
  const codes = countryCodes ?? ["TR", "DE", "FR", "IT", "ES", "JP", "BR", "CA", "AU", "EG"];
  const gameIds: string[] = [];
  for (let i = 0; i < dates.length; i += 1) {
    const at = dates[i]!;
    const result = await createCompletedGame({
      gameMasterPlayerId: hostPlayerId,
      winnerPlayerId,
      countryCode: codes[i % codes.length],
      uniqueWrongCountryCount: 1,
      startedAt: at,
      endedAt: at,
      participantPlayerIds: [winnerPlayerId],
    });
    gameIds.push(result.gameId);
  }
  return gameIds;
};

/** Participation games for play streak (player is guesser, not necessarily winner). */
export const addPlayGamesOnDays = async (
  playerId: string,
  hostPlayerId: string,
  dates: Date[],
) => {
  const gameIds: string[] = [];
  for (const at of dates) {
    const result = await createCompletedGame({
      gameMasterPlayerId: hostPlayerId,
      winnerPlayerId: playerId,
      uniqueWrongCountryCount: 2,
      startedAt: at,
      endedAt: at,
      participantPlayerIds: [playerId],
    });
    gameIds.push(result.gameId);
  }
  return gameIds;
};

export const addGoldMedal = async (playerId: string, periodType: PeriodType) => {
  const periodKey = `${SIM_PERIOD_KEY_PREFIX}${periodType}_${faker.string.uuid()}`;
  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = new Date("2026-02-01T00:00:00.000Z");
  const periodRows = await sqlClient`
    INSERT INTO award_period (
      period_type,
      period_key,
      starts_at,
      ends_at,
      announced_at
    )
    VALUES (
      ${periodType},
      ${periodKey},
      ${startsAt.toISOString()},
      ${endsAt.toISOString()},
      ${endsAt.toISOString()}
    )
    RETURNING id
  `;
  const awardPeriodId = String(periodRows[0]?.id);
  if (!awardPeriodId) {
    throw new Error("Failed to create sim award_period");
  }

  await sqlClient`
    INSERT INTO period_award (
      award_period_id,
      player_id,
      category,
      medal,
      rank_value,
      medal_points
    )
    VALUES (
      ${awardPeriodId},
      ${playerId},
      'points',
      'gold',
      1,
      ${MEDAL_POINTS.gold}
    )
  `;

  return { awardPeriodId, periodKey };
};

/** Istanbul calendar day at ~12:00 local as a UTC Date suitable for started_at. */
export const istanbulNoonUtc = (year: number, month: number, day: number) => {
  // Europe/Istanbul is UTC+3 year-round
  return new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
};

/** A Date whose Istanbul hour is in [0, 6). */
export const istanbulNightInstant = (year = 2026, month = 6, day = 15) =>
  // 02:00 Istanbul = 23:00 previous day UTC
  new Date(Date.UTC(year, month - 1, day - 1, 23, 0, 0));
