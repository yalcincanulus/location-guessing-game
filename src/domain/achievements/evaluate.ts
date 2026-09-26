import type { PeriodType } from "../awards/periods.ts";
import { sqlClient } from "../../db/client.ts";
import {
  ACHIEVEMENT_CATALOG,
  ONESHOT_TIER,
  crossedTiers,
  isAchievementInMode,
  medalistAchievementId,
  type AchievementDefinition,
} from "./catalog.ts";
import {
  getClutchWinMax,
  getComebackWinMax,
  getFirstBloodCount,
  getGmMilestoneCount,
  getGoldMedalCount,
  getHostStreak,
  getHostedCountryCount,
  getMaxHostedCrowd,
  getMaxHostedMultiplierHundredths,
  getMaxWinsSameCountry,
  getPlayStreak,
  getPlayerStatSnapshot,
  getTerritoryWinCount,
  getWonCountryCodes,
  hasContinentTour,
  wasPatientZero,
} from "./metrics.ts";
import { getOwnedTiers } from "../../repositories/achievements-repository.ts";
import { tablesFor, type GameMode } from "../game/game-mode.ts";

export type ProposedUnlock = {
  playerId: string;
  achievementId: string;
  tier: number;
  definition: AchievementDefinition;
  sourceGameId?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Ladder / oneshot proposals that check owned tiers in the given mode. */
const makeProposers = (mode: GameMode) => {
  const proposeLadder = async (
    playerId: string,
    definition: AchievementDefinition,
    value: number,
    sourceGameId?: string | null,
    meta?: Record<string, unknown> | null,
  ): Promise<ProposedUnlock[]> => {
    const owned = await getOwnedTiers(playerId, definition.id, mode);
    return crossedTiers(definition.tiers, value)
      .filter((tier) => !owned.has(tier))
      .map((tier) => ({
        playerId,
        achievementId: definition.id,
        tier,
        definition,
        sourceGameId,
        meta,
      }));
  };

  const proposeOneshot = async (
    playerId: string,
    definition: AchievementDefinition,
    earned: boolean,
    sourceGameId?: string | null,
    meta?: Record<string, unknown> | null,
  ): Promise<ProposedUnlock[]> => {
    if (!earned) {
      return [];
    }
    const owned = await getOwnedTiers(playerId, definition.id, mode);
    if (owned.has(ONESHOT_TIER)) {
      return [];
    }
    return [
      {
        playerId,
        achievementId: definition.id,
        tier: ONESHOT_TIER,
        definition,
        sourceGameId,
        meta,
      },
    ];
  };

  return { proposeLadder, proposeOneshot };
};

const def = (id: string) => {
  const found = ACHIEVEMENT_CATALOG.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown achievement: ${id}`);
  }
  return found;
};

export const istanbulHour = (at: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(at),
  );

const dedupe = (unlocks: ProposedUnlock[], mode: GameMode) => {
  const seen = new Set<string>();
  return unlocks.filter((unlock) => {
    if (!isAchievementInMode(unlock.achievementId, mode)) {
      return false;
    }
    const key = `${unlock.playerId}:${unlock.achievementId}:${unlock.tier}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export type GameStartedContext = {
  /** Defaults to `country`. */
  mode?: GameMode;
  playerId: string;
  gameId: string;
  countryCode: string;
  at: Date;
};

export const evaluateGameStarted = async (ctx: GameStartedContext): Promise<ProposedUnlock[]> => {
  const mode = ctx.mode ?? "country";
  const { proposeLadder, proposeOneshot } = makeProposers(mode);
  const unlocks: ProposedUnlock[] = [];
  const stats = await getPlayerStatSnapshot(ctx.playerId, mode);
  const hostStreak = await getHostStreak(ctx.playerId, ctx.at, mode);
  const hostedCountries = await getHostedCountryCount(ctx.playerId, mode);
  const hour = istanbulHour(ctx.at);

  unlocks.push(
    ...(await proposeLadder(ctx.playerId, def("host_games"), stats.gamesStarted, ctx.gameId)),
  );
  unlocks.push(
    ...(await proposeLadder(ctx.playerId, def("host_streak_days"), hostStreak.best, ctx.gameId)),
  );
  unlocks.push(
    ...(await proposeLadder(ctx.playerId, def("host_countries"), hostedCountries, ctx.gameId)),
  );
  unlocks.push(
    ...(await proposeLadder(
      ctx.playerId,
      def("dual_threat"),
      Math.min(stats.gamesStarted, stats.gamesWon),
      ctx.gameId,
    )),
  );

  if (hour >= 0 && hour < 6) {
    unlocks.push(...(await proposeOneshot(ctx.playerId, def("night_owl"), true, ctx.gameId)));
  }
  if (hour >= 6 && hour < 9) {
    unlocks.push(...(await proposeOneshot(ctx.playerId, def("early_bird"), true, ctx.gameId)));
  }

  return dedupe(unlocks, mode);
};

export type GameCompletedContext = {
  /** Defaults to `country`. */
  mode?: GameMode;
  gameId: string;
  winnerPlayerId: string;
  gameMasterPlayerId: string;
  participantPlayerIds: string[];
  uniqueWrongCountryCount: number;
  currentMultiplier: number;
  currentMultiplierMax: number;
  targetCountryCode: string;
  at: Date;
};

export const evaluateGameCompleted = async (
  ctx: GameCompletedContext,
): Promise<ProposedUnlock[]> => {
  const mode = ctx.mode ?? "country";
  const { proposeLadder, proposeOneshot } = makeProposers(mode);
  const unlocks: ProposedUnlock[] = [];
  const involved = new Set([
    ctx.winnerPlayerId,
    ctx.gameMasterPlayerId,
    ...ctx.participantPlayerIds,
  ]);
  const hour = istanbulHour(ctx.at);

  // Winner
  {
    const playerId = ctx.winnerPlayerId;
    const stats = await getPlayerStatSnapshot(playerId, mode);
    const playStreak = await getPlayStreak(playerId, ctx.at, mode);
    const wonCountryCodes = await getWonCountryCodes(playerId, mode);
    const sameCountry = await getMaxWinsSameCountry(playerId, mode);

    unlocks.push(
      ...(await proposeOneshot(playerId, def("guess_first"), stats.totalGuesses >= 1, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("play_games"), stats.gamesParticipated, ctx.gameId)),
    );
    unlocks.push(...(await proposeLadder(playerId, def("win_games"), stats.gamesWon, ctx.gameId)));
    unlocks.push(
      ...(await proposeLadder(playerId, def("points_total"), stats.pointsTotal, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("points_single"),
        stats.bestSingleGamePoints,
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("guess_volume"), stats.totalGuesses, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("play_streak_days"), playStreak.best, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("clutch_win"),
        await getClutchWinMax(playerId, mode),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeOneshot(
        playerId,
        def("oneshot_win"),
        ctx.uniqueWrongCountryCount === 0,
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("comeback_win"),
        await getComebackWinMax(playerId, mode),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("first_blood"),
        await getFirstBloodCount(playerId, mode),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("dual_threat"),
        Math.min(stats.gamesStarted, stats.gamesWon),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("win_countries"), wonCountryCodes.length, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("win_same_country"), sameCountry.wins, ctx.gameId, {
        countryCode: sameCountry.countryCode,
      })),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("territory_win"),
        await getTerritoryWinCount(playerId),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeOneshot(
        playerId,
        def("continent_tour"),
        await hasContinentTour(playerId),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeOneshot(
        playerId,
        def("multiplier_thief"),
        ctx.currentMultiplier >= ctx.currentMultiplierMax,
        ctx.gameId,
      )),
    );
    if (hour >= 0 && hour < 6) {
      unlocks.push(...(await proposeOneshot(playerId, def("night_owl"), true, ctx.gameId)));
    }
    if (hour >= 6 && hour < 9) {
      unlocks.push(...(await proposeOneshot(playerId, def("early_bird"), true, ctx.gameId)));
    }
  }

  // Game master
  {
    const playerId = ctx.gameMasterPlayerId;
    const stats = await getPlayerStatSnapshot(playerId, mode);
    unlocks.push(
      ...(await proposeLadder(playerId, def("host_hard"), stats.maxGameWrongAsGm, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("host_milestones"),
        await getGmMilestoneCount(playerId, mode),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("host_crowd"),
        await getMaxHostedCrowd(playerId, mode),
        ctx.gameId,
      )),
    );
    unlocks.push(
      ...(await proposeLadder(
        playerId,
        def("host_multiplier"),
        await getMaxHostedMultiplierHundredths(playerId, mode),
        ctx.gameId,
      )),
    );
  }

  // Other participants
  for (const playerId of involved) {
    if (playerId === ctx.winnerPlayerId) {
      continue;
    }
    const stats = await getPlayerStatSnapshot(playerId, mode);
    const playStreak = await getPlayStreak(playerId, ctx.at, mode);
    unlocks.push(
      ...(await proposeOneshot(playerId, def("guess_first"), stats.totalGuesses >= 1, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("play_games"), stats.gamesParticipated, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("guess_volume"), stats.totalGuesses, ctx.gameId)),
    );
    unlocks.push(
      ...(await proposeLadder(playerId, def("play_streak_days"), playStreak.best, ctx.gameId)),
    );
  }

  for (const playerId of involved) {
    if (await wasPatientZero(playerId, ctx.gameId, mode)) {
      unlocks.push(...(await proposeOneshot(playerId, def("patient_zero"), true, ctx.gameId)));
    }
  }

  return dedupe(unlocks, mode);
};

export const evaluateMedalistForPlayer = async (
  playerId: string,
  periodType: PeriodType,
  mode: GameMode = "country",
): Promise<ProposedUnlock[]> => {
  const { proposeLadder } = makeProposers(mode);
  const definition = def(medalistAchievementId(periodType));
  const count = await getGoldMedalCount(playerId, periodType, mode);
  return proposeLadder(playerId, definition, count);
};

export const evaluateDailyStreaksForPlayer = async (
  playerId: string,
  now = new Date(),
  mode: GameMode = "country",
): Promise<ProposedUnlock[]> => {
  const { proposeLadder } = makeProposers(mode);
  const unlocks: ProposedUnlock[] = [];
  const hostStreak = await getHostStreak(playerId, now, mode);
  const playStreak = await getPlayStreak(playerId, now, mode);
  const stats = await getPlayerStatSnapshot(playerId, mode);
  unlocks.push(...(await proposeLadder(playerId, def("host_streak_days"), hostStreak.best)));
  unlocks.push(...(await proposeLadder(playerId, def("play_streak_days"), playStreak.best)));
  unlocks.push(...(await proposeLadder(playerId, def("host_games"), stats.gamesStarted)));
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("host_countries"),
      await getHostedCountryCount(playerId, mode),
    )),
  );
  return dedupe(unlocks, mode);
};

/** Full backfill evaluation for one player (all metrics). */
export const evaluateFullBackfillForPlayer = async (
  playerId: string,
  now = new Date(),
  mode: GameMode = "country",
): Promise<ProposedUnlock[]> => {
  const t = tablesFor(mode);
  const { proposeLadder, proposeOneshot } = makeProposers(mode);
  const unlocks: ProposedUnlock[] = [];
  const stats = await getPlayerStatSnapshot(playerId, mode);
  const hostStreak = await getHostStreak(playerId, now, mode);
  const playStreak = await getPlayStreak(playerId, now, mode);
  const wonCountries = await getWonCountryCodes(playerId, mode);
  const sameCountry = await getMaxWinsSameCountry(playerId, mode);

  unlocks.push(...(await proposeLadder(playerId, def("host_games"), stats.gamesStarted)));
  unlocks.push(...(await proposeLadder(playerId, def("host_hard"), stats.maxGameWrongAsGm)));
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("host_milestones"),
      await getGmMilestoneCount(playerId, mode),
    )),
  );
  unlocks.push(
    ...(await proposeLadder(playerId, def("host_crowd"), await getMaxHostedCrowd(playerId, mode))),
  );
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("host_multiplier"),
      await getMaxHostedMultiplierHundredths(playerId, mode),
    )),
  );
  unlocks.push(...(await proposeLadder(playerId, def("host_streak_days"), hostStreak.best)));
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("host_countries"),
      await getHostedCountryCount(playerId, mode),
    )),
  );

  unlocks.push(...(await proposeOneshot(playerId, def("guess_first"), stats.totalGuesses >= 1)));
  unlocks.push(...(await proposeLadder(playerId, def("play_games"), stats.gamesParticipated)));
  unlocks.push(...(await proposeLadder(playerId, def("win_games"), stats.gamesWon)));
  unlocks.push(...(await proposeLadder(playerId, def("points_total"), stats.pointsTotal)));
  unlocks.push(
    ...(await proposeLadder(playerId, def("points_single"), stats.bestSingleGamePoints)),
  );
  unlocks.push(...(await proposeLadder(playerId, def("guess_volume"), stats.totalGuesses)));
  unlocks.push(...(await proposeLadder(playerId, def("play_streak_days"), playStreak.best)));
  unlocks.push(
    ...(await proposeLadder(playerId, def("clutch_win"), await getClutchWinMax(playerId, mode))),
  );

  const oneshotRows = await sqlClient`
    SELECT EXISTS (
      SELECT 1 FROM ${sqlClient(t.game)}
      WHERE winner_player_id = ${playerId}
        AND is_test = false
        AND status = 'completed'
        AND ${sqlClient(t.uniqueWrongColumn)} = 0
    ) AS earned
  `;
  unlocks.push(
    ...(await proposeOneshot(playerId, def("oneshot_win"), Boolean(oneshotRows[0]?.earned))),
  );

  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("comeback_win"),
      await getComebackWinMax(playerId, mode),
    )),
  );
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("first_blood"),
      await getFirstBloodCount(playerId, mode),
    )),
  );
  unlocks.push(
    ...(await proposeLadder(
      playerId,
      def("dual_threat"),
      Math.min(stats.gamesStarted, stats.gamesWon),
    )),
  );

  for (const periodType of ["daily", "weekly", "monthly", "seasonal", "yearly"] as PeriodType[]) {
    unlocks.push(...(await evaluateMedalistForPlayer(playerId, periodType, mode)));
  }

  unlocks.push(...(await proposeLadder(playerId, def("win_countries"), wonCountries.length)));
  unlocks.push(
    ...(await proposeLadder(playerId, def("win_same_country"), sameCountry.wins, null, {
      countryCode: sameCountry.countryCode,
    })),
  );
  unlocks.push(
    ...(await proposeLadder(playerId, def("territory_win"), await getTerritoryWinCount(playerId))),
  );
  unlocks.push(
    ...(await proposeOneshot(playerId, def("continent_tour"), await hasContinentTour(playerId))),
  );

  const rareRows = await sqlClient`
    SELECT
      EXISTS (
        SELECT 1 FROM ${sqlClient(t.game)}
        WHERE winner_player_id = ${playerId}
          AND is_test = false
          AND status = 'completed'
          AND current_multiplier_final >= (
            SELECT COALESCE(current_multiplier_max, 2) FROM rule LIMIT 1
          )
      ) AS multiplier_thief,
      EXISTS (
        SELECT 1 FROM ${sqlClient(t.game)} g
        WHERE g.is_test = false
          AND g.status = 'completed'
          AND g.${sqlClient(t.uniqueWrongColumn)} >= 100
          AND (
            SELECT gu.player_id FROM ${sqlClient(t.guess)} gu
            WHERE gu.game_id = g.id
              AND gu.is_correct = false AND gu.is_repeat = false AND gu.is_rate_limited = false
            ORDER BY gu.created_at ASC LIMIT 1
          ) = ${playerId}
      ) AS patient_zero
  `;
  unlocks.push(
    ...(await proposeOneshot(
      playerId,
      def("multiplier_thief"),
      Boolean(rareRows[0]?.multiplier_thief),
    )),
  );
  unlocks.push(
    ...(await proposeOneshot(playerId, def("patient_zero"), Boolean(rareRows[0]?.patient_zero))),
  );

  const timeRows = await sqlClient`
    SELECT
      EXISTS (
        SELECT 1 FROM ${sqlClient(t.game)} g
        WHERE g.is_test = false
          AND (
            g.game_master_player_id = ${playerId}
            OR g.winner_player_id = ${playerId}
          )
          AND EXTRACT(HOUR FROM (COALESCE(g.ended_at, g.started_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')) >= 0
          AND EXTRACT(HOUR FROM (COALESCE(g.ended_at, g.started_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')) < 6
      ) AS night_owl,
      EXISTS (
        SELECT 1 FROM ${sqlClient(t.game)} g
        WHERE g.is_test = false
          AND (
            g.game_master_player_id = ${playerId}
            OR g.winner_player_id = ${playerId}
          )
          AND EXTRACT(HOUR FROM (COALESCE(g.ended_at, g.started_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')) >= 6
          AND EXTRACT(HOUR FROM (COALESCE(g.ended_at, g.started_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')) < 9
      ) AS early_bird
  `;
  unlocks.push(
    ...(await proposeOneshot(playerId, def("night_owl"), Boolean(timeRows[0]?.night_owl))),
  );
  unlocks.push(
    ...(await proposeOneshot(playerId, def("early_bird"), Boolean(timeRows[0]?.early_bird))),
  );

  return dedupe(unlocks, mode);
};
