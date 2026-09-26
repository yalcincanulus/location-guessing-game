import type { Client } from "discord.js";
import type { PeriodType } from "../awards/periods.ts";
import { insertUnlocks, listAllPlayerIds } from "../../repositories/achievements-repository.ts";
import { logger } from "../../util/logger.ts";
import type { GameMode } from "../game/game-mode.ts";
import { persistAndAnnounceUnlocks } from "./announce.ts";
import {
  evaluateDailyStreaksForPlayer,
  evaluateFullBackfillForPlayer,
  evaluateGameCompleted,
  evaluateGameStarted,
  evaluateMedalistForPlayer,
  type GameCompletedContext,
  type GameStartedContext,
} from "./evaluate.ts";

export const onGameStarted = async (client: Client, ctx: GameStartedContext) => {
  try {
    const proposed = await evaluateGameStarted(ctx);
    await persistAndAnnounceUnlocks(client, proposed, { announceChannel: true, mode: ctx.mode });
  } catch (error) {
    logger.error("Achievement evaluation failed on game start", {
      error: error instanceof Error ? error.message : String(error),
      gameId: ctx.gameId,
    });
  }
};

export const onGameCompleted = async (client: Client, ctx: GameCompletedContext) => {
  try {
    const proposed = await evaluateGameCompleted(ctx);
    await persistAndAnnounceUnlocks(client, proposed, { announceChannel: true, mode: ctx.mode });
  } catch (error) {
    logger.error("Achievement evaluation failed on game complete", {
      error: error instanceof Error ? error.message : String(error),
      gameId: ctx.gameId,
    });
  }
};

export const onPeriodAwardsFinalized = async (
  client: Client,
  periodType: PeriodType,
  goldPlayerIds: string[],
  mode: GameMode = "country",
) => {
  try {
    const proposed = [];
    for (const playerId of goldPlayerIds) {
      proposed.push(...(await evaluateMedalistForPlayer(playerId, periodType, mode)));
    }
    await persistAndAnnounceUnlocks(client, proposed, { announceChannel: true, mode });
  } catch (error) {
    logger.error("Achievement evaluation failed on period awards", {
      error: error instanceof Error ? error.message : String(error),
      periodType,
    });
  }
};

export const runDailyAchievementStreaks = async (client: Client, mode: GameMode = "country") => {
  const playerIds = await listAllPlayerIds();
  let unlockCount = 0;
  for (const playerId of playerIds) {
    const proposed = await evaluateDailyStreaksForPlayer(playerId, new Date(), mode);
    const inserted = await persistAndAnnounceUnlocks(client, proposed, {
      announceChannel: true,
      mode,
    });
    unlockCount += inserted.length;
  }
  logger.info("Daily achievement streak check completed", {
    mode,
    players: playerIds.length,
    unlocks: unlockCount,
  });
  return { players: playerIds.length, unlocks: unlockCount };
};

export const runAchievementsBackfill = async (mode: GameMode = "country") => {
  const playerIds = await listAllPlayerIds();
  let unlockCount = 0;
  let errors = 0;
  for (const playerId of playerIds) {
    try {
      const proposed = await evaluateFullBackfillForPlayer(playerId, new Date(), mode);
      const inserted = await insertUnlocks(
        proposed.map((unlock) => ({
          playerId: unlock.playerId,
          achievementId: unlock.achievementId,
          tier: unlock.tier,
          sourceGameId: unlock.sourceGameId,
          meta: unlock.meta,
        })),
        mode,
      );
      unlockCount += inserted.length;
    } catch (error) {
      errors += 1;
      logger.error("Achievement backfill failed for player", {
        playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { players: playerIds.length, unlocks: unlockCount, errors };
};
