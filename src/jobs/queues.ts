import { Queue, Worker } from "bullmq";
import type { Client } from "discord.js";
import { env } from "../config/env.ts";
import {
  getActiveGameState,
  getGameStateById,
  updateGameState,
} from "../domain/game/active-game-state.ts";
import {
  clearPendingStart,
  clearStartReservation,
  getStartReservation,
} from "../domain/game/start-reservation.ts";
import { loadRules } from "../config/rules.ts";
import { clampMultiplier } from "../domain/game/scoring.ts";
import { sqlClient } from "../db/client.ts";
import { logger } from "../util/logger.ts";
import { redis } from "../redis/client.ts";
import { keys } from "../redis/keys.ts";
import { messages } from "../i18n/messages.ts";

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

export const startReservationQueue = new Queue("game-start-reservation", {
  connection: bullConnection,
});

const startReservationJobId = (guildId: string, channelId: string) =>
  `start-reservation:${guildId}:${channelId}`;

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

export const scheduleStartReservationExpiry = async (
  guildId: string,
  channelId: string,
  userId: string,
  pendingKey: string,
  missing: "screenshot" | "link",
  delayMs: number,
) => {
  const jobId = startReservationJobId(guildId, channelId);
  const existing = await startReservationQueue.getJob(jobId);
  if (existing) {
    await existing.remove().catch(() => undefined);
  }

  await startReservationQueue.add(
    "expire-reservation",
    { guildId, channelId, userId, pendingKey, missing },
    {
      jobId,
      delay: Math.max(1000, delayMs),
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};

export const cancelStartReservationExpiry = async (guildId: string, channelId: string) => {
  const job = await startReservationQueue.getJob(startReservationJobId(guildId, channelId));
  if (job) {
    await job.remove().catch(() => undefined);
  }
};

export const expireStartReservation = async (
  client: Client,
  guildId: string,
  channelId: string,
  userId: string,
  pendingKey: string,
  missing: "screenshot" | "link",
) => {
  const reservation = await getStartReservation(guildId, channelId);
  if (reservation && reservation.userId !== userId) {
    return;
  }

  const active = await getActiveGameState(guildId, channelId);
  if (active) {
    await clearStartReservation(guildId, channelId);
    return;
  }

  // Reservation key may already have expired; still clear pending and announce
  // using the job payload so the channel is unblocked.
  await clearPendingStart(reservation?.pendingKey ?? pendingKey);
  await clearStartReservation(guildId, channelId);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel.send(
      messages.start.startReservationExpired(userId, reservation?.missing ?? missing),
    );
  }
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

export const recoverStartReservationJobs = async () => {
  const reservationKeys = await redis.keys("start-reservation:*");
  const delayedJobs = await startReservationQueue.getDelayed();
  const scheduled = new Set(
    delayedJobs.map((job) =>
      startReservationJobId(String(job.data?.guildId), String(job.data?.channelId)),
    ),
  );

  for (const reservationKey of reservationKeys) {
    const parts = reservationKey.split(":");
    // start-reservation:{guildId}:{channelId}
    if (parts.length < 3) {
      continue;
    }
    const guildId = parts[1]!;
    const channelId = parts.slice(2).join(":");
    const jobId = startReservationJobId(guildId, channelId);
    if (scheduled.has(jobId)) {
      continue;
    }

    const reservation = await getStartReservation(guildId, channelId);
    if (!reservation) {
      continue;
    }

    const ttl = await redis.ttl(keys.startReservation(guildId, channelId));
    await scheduleStartReservationExpiry(
      guildId,
      channelId,
      reservation.userId,
      reservation.pendingKey,
      reservation.missing,
      Math.max(1000, ttl > 0 ? ttl * 1000 : 1000),
    );
    logger.info("Recovered missing start reservation expiry job", { guildId, channelId });
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
    const sent = await channel.send(messages.jobs.multiplierIncreased(state.currentMultiplier));
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

export const startReservationWorker = (client: Client) =>
  new Worker(
    "game-start-reservation",
    async (job) => {
      const guildId = String(job.data.guildId);
      const channelId = String(job.data.channelId);
      const userId = String(job.data.userId);
      const pendingKey = String(job.data.pendingKey);
      const missing = job.data.missing === "link" ? "link" : "screenshot";
      await expireStartReservation(client, guildId, channelId, userId, pendingKey, missing);
    },
    { connection: bullConnection },
  );

export const closeQueues = async () => {
  await Promise.all([multiplierQueue.close(), startReservationQueue.close()]);
};

export const logWorkerError = (worker: Worker) => {
  worker.on("failed", (job, error) => {
    logger.error("BullMQ job failed", { jobId: job?.id, name: job?.name, error: error.message });
  });
};
