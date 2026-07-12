import {
  evaluateFullBackfillForPlayer,
  evaluateGameCompleted,
  evaluateGameStarted,
  evaluateMedalistForPlayer,
  type ProposedUnlock,
} from "../../src/domain/achievements/evaluate.ts";
import { insertUnlocks } from "../../src/repositories/achievements-repository.ts";
import {
  addGoldMedal,
  addHostGamesOnDays,
  addPlayGamesOnDays,
  createCompletedGame,
  createSimPlayer,
  istanbulNightInstant,
  istanbulNoonUtc,
  setPlayerStats,
} from "./seed.ts";

export type ExpectedUnlock = {
  playerId: string;
  achievementId: string;
  tier: number;
};

export type ScenarioResult = {
  name: string;
  proposed: ProposedUnlock[];
  inserted: Awaited<ReturnType<typeof insertUnlocks>>;
  expected: ExpectedUnlock[];
  /** Extra checks beyond expected membership (e.g. second insert empty). */
  extraOk?: boolean;
  extraMessage?: string;
};

export type Scenario = {
  name: string;
  run: () => Promise<ScenarioResult>;
};

const unlockKey = (playerId: string, achievementId: string, tier: number) =>
  `${playerId}:${achievementId}:${tier}`;

export const assertExpected = (
  expected: ExpectedUnlock[],
  actual: { playerId: string; achievementId: string; tier: number }[],
) => {
  const got = new Set(actual.map((u) => unlockKey(u.playerId, u.achievementId, u.tier)));
  const missing = expected.filter((e) => !got.has(unlockKey(e.playerId, e.achievementId, e.tier)));
  return missing;
};

const persist = async (proposed: ProposedUnlock[]) =>
  insertUnlocks(
    proposed.map((u) => ({
      playerId: u.playerId,
      achievementId: u.achievementId,
      tier: u.tier,
      sourceGameId: u.sourceGameId,
      meta: u.meta,
    })),
  );

export const scenarios: Scenario[] = [
  {
    name: "oneshot_win",
    run: async () => {
      const gm = await createSimPlayer("SimGM");
      const winner = await createSimPlayer("SimWinner");
      await setPlayerStats(winner.id, {
        gamesParticipated: 1,
        gamesWon: 1,
        totalGuesses: 1,
      });
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: gm.id,
        winnerPlayerId: winner.id,
        uniqueWrongCountryCount: 0,
      });
      const proposed = await evaluateGameCompleted({
        gameId,
        winnerPlayerId: winner.id,
        gameMasterPlayerId: gm.id,
        participantPlayerIds: [winner.id],
        uniqueWrongCountryCount: 0,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: new Date(),
      });
      const inserted = await persist(proposed);
      return {
        name: "oneshot_win",
        proposed,
        inserted,
        expected: [{ playerId: winner.id, achievementId: "oneshot_win", tier: 0 }],
      };
    },
  },
  {
    name: "clutch_win",
    run: async () => {
      const gm = await createSimPlayer();
      const winner = await createSimPlayer();
      await setPlayerStats(winner.id, {
        gamesParticipated: 1,
        gamesWon: 1,
        totalGuesses: 1,
      });
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: gm.id,
        winnerPlayerId: winner.id,
        uniqueWrongCountryCount: 25,
      });
      const proposed = await evaluateGameCompleted({
        gameId,
        winnerPlayerId: winner.id,
        gameMasterPlayerId: gm.id,
        participantPlayerIds: [winner.id],
        uniqueWrongCountryCount: 25,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: new Date(),
      });
      const inserted = await persist(proposed);
      return {
        name: "clutch_win",
        proposed,
        inserted,
        expected: [{ playerId: winner.id, achievementId: "clutch_win", tier: 25 }],
      };
    },
  },
  {
    name: "host_games_and_countries",
    run: async () => {
      const host = await createSimPlayer();
      const winner = await createSimPlayer();
      const countries = ["TR", "DE", "FR", "IT", "ES"];
      const dates = countries.map((_, i) => istanbulNoonUtc(2026, 3, 1 + i));
      const gameIds = await addHostGamesOnDays(host.id, winner.id, dates, countries);
      await setPlayerStats(host.id, { gamesStarted: 5 });
      const lastGameId = gameIds[gameIds.length - 1]!;
      const proposed = await evaluateGameStarted({
        playerId: host.id,
        gameId: lastGameId,
        countryCode: "ES",
        at: dates[dates.length - 1]!,
      });
      const inserted = await persist(proposed);
      return {
        name: "host_games_and_countries",
        proposed,
        inserted,
        expected: [
          { playerId: host.id, achievementId: "host_games", tier: 1 },
          { playerId: host.id, achievementId: "host_countries", tier: 5 },
        ],
      };
    },
  },
  {
    name: "host_crowd",
    run: async () => {
      const gm = await createSimPlayer();
      const winner = await createSimPlayer();
      const extras = await Promise.all([
        createSimPlayer(),
        createSimPlayer(),
        createSimPlayer(),
        createSimPlayer(),
      ]);
      const participants = [winner.id, ...extras.map((p) => p.id)];
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: gm.id,
        winnerPlayerId: winner.id,
        uniqueWrongCountryCount: 5,
        participantPlayerIds: participants,
      });
      await setPlayerStats(gm.id, { gamesStarted: 1, maxGameWrongGuessCountAsGm: 5 });
      const proposed = await evaluateGameCompleted({
        gameId,
        winnerPlayerId: winner.id,
        gameMasterPlayerId: gm.id,
        participantPlayerIds: participants,
        uniqueWrongCountryCount: 5,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: new Date(),
      });
      const inserted = await persist(proposed);
      return {
        name: "host_crowd",
        proposed,
        inserted,
        expected: [{ playerId: gm.id, achievementId: "host_crowd", tier: 5 }],
      };
    },
  },
  {
    name: "host_streak_days",
    run: async () => {
      const host = await createSimPlayer();
      const winner = await createSimPlayer();
      const dates = [
        istanbulNoonUtc(2026, 4, 1),
        istanbulNoonUtc(2026, 4, 2),
        istanbulNoonUtc(2026, 4, 3),
      ];
      const gameIds = await addHostGamesOnDays(host.id, winner.id, dates);
      await setPlayerStats(host.id, { gamesStarted: 3 });
      const proposed = await evaluateGameStarted({
        playerId: host.id,
        gameId: gameIds[2]!,
        countryCode: "TR",
        at: dates[2]!,
      });
      const inserted = await persist(proposed);
      return {
        name: "host_streak_days",
        proposed,
        inserted,
        expected: [{ playerId: host.id, achievementId: "host_streak_days", tier: 3 }],
      };
    },
  },
  {
    name: "play_streak_days",
    run: async () => {
      const host = await createSimPlayer();
      const player = await createSimPlayer();
      const dates = [
        istanbulNoonUtc(2026, 5, 10),
        istanbulNoonUtc(2026, 5, 11),
        istanbulNoonUtc(2026, 5, 12),
      ];
      const gameIds = await addPlayGamesOnDays(player.id, host.id, dates);
      await setPlayerStats(player.id, {
        gamesParticipated: 3,
        gamesWon: 3,
        totalGuesses: 3,
      });
      const proposed = await evaluateGameCompleted({
        gameId: gameIds[2]!,
        winnerPlayerId: player.id,
        gameMasterPlayerId: host.id,
        participantPlayerIds: [player.id],
        uniqueWrongCountryCount: 2,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: dates[2]!,
      });
      const inserted = await persist(proposed);
      return {
        name: "play_streak_days",
        proposed,
        inserted,
        expected: [{ playerId: player.id, achievementId: "play_streak_days", tier: 3 }],
      };
    },
  },
  {
    name: "comeback_win",
    run: async () => {
      const gm = await createSimPlayer();
      const winner = await createSimPlayer();
      await setPlayerStats(winner.id, {
        gamesParticipated: 1,
        gamesWon: 1,
        totalGuesses: 11,
      });
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: gm.id,
        winnerPlayerId: winner.id,
        uniqueWrongCountryCount: 15,
        winnerUniqueWrongGuessCount: 10,
      });
      const proposed = await evaluateGameCompleted({
        gameId,
        winnerPlayerId: winner.id,
        gameMasterPlayerId: gm.id,
        participantPlayerIds: [winner.id],
        uniqueWrongCountryCount: 15,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: new Date(),
      });
      const inserted = await persist(proposed);
      return {
        name: "comeback_win",
        proposed,
        inserted,
        expected: [{ playerId: winner.id, achievementId: "comeback_win", tier: 10 }],
      };
    },
  },
  {
    name: "medalist_monthly",
    run: async () => {
      const player = await createSimPlayer();
      await addGoldMedal(player.id, "monthly");
      const proposed = await evaluateMedalistForPlayer(player.id, "monthly");
      const inserted = await persist(proposed);
      return {
        name: "medalist_monthly",
        proposed,
        inserted,
        expected: [{ playerId: player.id, achievementId: "medalist_monthly", tier: 1 }],
      };
    },
  },
  {
    name: "night_owl",
    run: async () => {
      const host = await createSimPlayer();
      const winner = await createSimPlayer();
      await setPlayerStats(host.id, { gamesStarted: 1 });
      const at = istanbulNightInstant();
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: host.id,
        winnerPlayerId: winner.id,
        startedAt: at,
        endedAt: at,
      });
      const proposed = await evaluateGameStarted({
        playerId: host.id,
        gameId,
        countryCode: "TR",
        at,
      });
      const inserted = await persist(proposed);
      return {
        name: "night_owl",
        proposed,
        inserted,
        expected: [{ playerId: host.id, achievementId: "night_owl", tier: 0 }],
      };
    },
  },
  {
    name: "idempotency",
    run: async () => {
      const gm = await createSimPlayer();
      const winner = await createSimPlayer();
      await setPlayerStats(winner.id, {
        gamesParticipated: 1,
        gamesWon: 1,
        totalGuesses: 1,
      });
      const { gameId } = await createCompletedGame({
        gameMasterPlayerId: gm.id,
        winnerPlayerId: winner.id,
        uniqueWrongCountryCount: 0,
      });
      const ctx = {
        gameId,
        winnerPlayerId: winner.id,
        gameMasterPlayerId: gm.id,
        participantPlayerIds: [winner.id],
        uniqueWrongCountryCount: 0,
        currentMultiplier: 1,
        currentMultiplierMax: 2,
        targetCountryCode: "TR",
        at: new Date(),
      };
      const proposed1 = await evaluateGameCompleted(ctx);
      const inserted1 = await persist(proposed1);
      const proposed2 = await evaluateGameCompleted(ctx);
      const inserted2 = await persist(proposed2);
      const secondEmpty = inserted2.length === 0;
      return {
        name: "idempotency",
        proposed: proposed1,
        inserted: inserted1,
        expected: [{ playerId: winner.id, achievementId: "oneshot_win", tier: 0 }],
        extraOk: secondEmpty,
        extraMessage: secondEmpty
          ? "second insert empty"
          : `second insert returned ${inserted2.length} rows`,
      };
    },
  },
  {
    name: "backfill_smoke",
    run: async () => {
      const player = await createSimPlayer();
      const other = await createSimPlayer();
      await setPlayerStats(player.id, {
        gamesStarted: 10,
        gamesParticipated: 10,
        gamesWon: 5,
        totalGuesses: 50,
        pointsTotal: 500,
        bestSingleGamePoints: 150,
      });
      await addHostGamesOnDays(
        player.id,
        other.id,
        Array.from({ length: 10 }, (_, i) => istanbulNoonUtc(2026, 1, 1 + i)),
        ["TR", "DE", "FR", "IT", "ES", "JP", "BR", "CA", "AU", "EG"],
      );
      const proposed = await evaluateFullBackfillForPlayer(player.id);
      const inserted = await persist(proposed);
      return {
        name: "backfill_smoke",
        proposed,
        inserted,
        expected: [
          { playerId: player.id, achievementId: "host_games", tier: 1 },
          { playerId: player.id, achievementId: "host_games", tier: 10 },
          { playerId: player.id, achievementId: "host_countries", tier: 5 },
          { playerId: player.id, achievementId: "play_games", tier: 1 },
          { playerId: player.id, achievementId: "play_games", tier: 10 },
          { playerId: player.id, achievementId: "win_games", tier: 1 },
          { playerId: player.id, achievementId: "win_games", tier: 5 },
          { playerId: player.id, achievementId: "points_total", tier: 500 },
          { playerId: player.id, achievementId: "points_single", tier: 150 },
          { playerId: player.id, achievementId: "guess_volume", tier: 50 },
        ],
      };
    },
  },
];
