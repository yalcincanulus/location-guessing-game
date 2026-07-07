import { Queue, Worker } from "bullmq";
import type { Client } from "discord.js";
import { env } from "../config/env.ts";
import { getGameStateById, updateGameState } from "../domain/game/active-game-state.ts";
import { loadRules } from "../config/rules.ts";
import { clampMultiplier } from "../domain/game/scoring.ts";
import { sqlClient } from "../db/client.ts";
import { logger } from "../util/logger.ts";
import { redis } from "../redis/client.ts";

const redisUrl = new URL(env.redisUrl);
const bullConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : undefined,
  maxRetriesPerRequest: null,
};

export const multiplierQueue = new Queue("game-multiplier", {
  connection: bullConnection,
});

export const scheduleIdleMultiplier = async (gameId: string, delayMs: number) => {
  const dueAt = Date.now() + Math.max(1000, delayMs);
  await multiplierQueue.add(
    "idle-check",
    { gameId },
    {
      jobId: `idle-multiplier:${gameId}:${dueAt}`,
      delay: Math.max(1000, delayMs),
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};

export const recoverActiveMultiplierJobs = async () => {
  const rules = await loadRules();
  const activeKeys = await redis.keys("game:active:*");
  const scheduledGameIds = new Set<string>();
  const delayedJobs = await multiplierQueue.getDelayed();

  for (const job of delayedJobs) {
    const gameId = String(job.data?.gameId ?? "");
    if (gameId) {
      scheduledGameIds.add(gameId);
    }
  }

  for (const activeKey of activeKeys) {
    const gameId = await redis.get(activeKey);
    if (!gameId || scheduledGameIds.has(gameId)) {
      continue;
    }

    const state = await getGameStateById(gameId);
    if (!state) {
      continue;
    }

    const elapsed = Date.now() - state.lastGuessAt;
    const interval = rules.idleMultiplierIntervalSeconds * 1000;
    await scheduleIdleMultiplier(gameId, Math.max(1000, interval - elapsed));
    logger.info("Recovered missing multiplier job", { gameId });
  }
};

export type MultiplierCheckResult =
  | { status: "missing-game" }
  | { status: "not-idle"; currentMultiplier: number; idleMs: number; intervalMs: number }
  | { status: "capped"; currentMultiplier: number }
  | { status: "increased"; previousMultiplier: number; newMultiplier: number; messageId?: string };

export const runIdleMultiplierCheck = async (
  client: Client,
  gameId: string,
  options: { force?: boolean } = {},
): Promise<MultiplierCheckResult> => {
  const state = await getGameStateById(gameId);
  if (!state) {
    return { status: "missing-game" };
  }

  const rules = await loadRules();
  const idleMs = Date.now() - state.lastGuessAt;
  const intervalMs = rules.idleMultiplierIntervalSeconds * 1000;

  if (!options.force && idleMs < intervalMs) {
    return {
      status: "not-idle",
      currentMultiplier: state.currentMultiplier,
      idleMs,
      intervalMs,
    };
  }

  if (state.currentMultiplier >= rules.currentMultiplierMax) {
    return { status: "capped", currentMultiplier: state.currentMultiplier };
  }

  const previous = state.currentMultiplier;
  state.currentMultiplier = clampMultiplier(
    state.currentMultiplier + rules.idleMultiplierIncrement,
    rules.currentMultiplierMax,
  );
  await updateGameState(state);

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  let messageId: string | undefined;
  if (channel?.isSendable()) {
    const sent = await channel.send(
      `Current multiplier increased to **${state.currentMultiplier.toFixed(2)}x**.`,
    );
    messageId = sent.id;
  }

  await sqlClient`
    INSERT INTO multiplier_event (game_id, kind, previous_multiplier, increment, new_multiplier, message_id)
    VALUES (${state.gameId}, 'idle', ${previous}, ${rules.idleMultiplierIncrement}, ${state.currentMultiplier}, ${messageId ?? null})
  `;

  return {
    status: "increased",
    previousMultiplier: previous,
    newMultiplier: state.currentMultiplier,
    messageId,
  };
};

export const removeMultiplierJobsForGame = async (gameId: string) => {
  const jobGroups = await Promise.all([
    multiplierQueue.getDelayed(),
    multiplierQueue.getWaiting(),
    multiplierQueue.getActive(),
  ]);

  for (const job of jobGroups.flat()) {
    if (job.data?.gameId === gameId) {
      await job.remove();
    }
  }
};

export const startMultiplierWorker = (client: Client) =>
  new Worker(
    "game-multiplier",
    async (job) => {
      const gameId = String(job.data.gameId);
      const rules = await loadRules();
      const result = await runIdleMultiplierCheck(client, gameId, { force: false });
      if (result.status !== "missing-game") {
        await scheduleIdleMultiplier(gameId, rules.idleMultiplierIntervalSeconds * 1000);
      }
    },
    { connection: bullConnection },
  );

export const closeQueues = async () => {
  await multiplierQueue.close();
};

export const logWorkerError = (worker: Worker) => {
  worker.on("failed", (job, error) => {
    logger.error("BullMQ job failed", { jobId: job?.id, name: job?.name, error: error.message });
  });
};
