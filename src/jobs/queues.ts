import { Queue, Worker } from "bullmq";
import type { Client } from "discord.js";
import { env } from "../config/env.ts";
import { getGameStateById, updateGameState } from "../domain/game/active-game-state.ts";
import { loadRules } from "../config/rules.ts";
import { clampMultiplier } from "../domain/game/scoring.ts";
import { sqlClient } from "../db/client.ts";
import { logger } from "../util/logger.ts";

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
  await multiplierQueue.add(
    "idle-check",
    { gameId },
    {
      jobId: `idle-multiplier:${gameId}`,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};

export const startMultiplierWorker = (client: Client) =>
  new Worker(
    "game-multiplier",
    async (job) => {
      const gameId = String(job.data.gameId);
      const state = await getGameStateById(gameId);
      if (!state) {
        return;
      }

      const rules = await loadRules();
      const idleMs = Date.now() - state.lastGuessAt;
      const intervalMs = rules.idleMultiplierIntervalSeconds * 1000;

      if (idleMs >= intervalMs && state.currentMultiplier < rules.currentMultiplierMax) {
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
      }

      await scheduleIdleMultiplier(gameId, intervalMs);
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
