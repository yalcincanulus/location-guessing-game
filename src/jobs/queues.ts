import { Queue, Worker, createBunRedisClient } from "bullmq";
import type { Client } from "discord.js";
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
import { createRedisConnection, redis } from "../redis/client.ts";
import { keys } from "../redis/keys.ts";
import { messages } from "../i18n/messages.ts";
import { runPeriodAwardsCheck } from "../domain/awards/announce.ts";
import { runDailyAchievementStreaks } from "../domain/achievements/hooks.ts";
import {
  IDLE_REMINDER_TZ,
  ONCE_TTL_SECONDS,
  SCHEDULER_POLL_MS,
  idleReminderHour,
  istanbulDayKey,
} from "./schedule.ts";

const bullmqConnection = createBunRedisClient(createRedisConnection("bullmq"));
bullmqConnection.on("error", (error: Error) => {
  logger.error("BullMQ Redis connection error", { error: error.message });
});

const schedulerJobOpts = {
  removeOnComplete: 20,
  removeOnFail: 50,
};
const heavyWorkerOpts = {
  connection: bullmqConnection,
  lockDuration: 120_000,
  stalledInterval: 60_000,
};

export const multiplierQueue = new Queue("game-multiplier", {
  connection: bullmqConnection,
});

export const startReservationQueue = new Queue("game-start-reservation", {
  connection: bullmqConnection,
});

export const idleReminderQueue = new Queue("channel-idle-reminder", {
  connection: bullmqConnection,
});

export const periodAwardsQueue = new Queue("period-awards", {
  connection: bullmqConnection,
});

export const achievementStreakQueue = new Queue("achievement-streaks", {
  connection: bullmqConnection,
});

for (const queue of [
  multiplierQueue,
  startReservationQueue,
  idleReminderQueue,
  periodAwardsQueue,
  achievementStreakQueue,
]) {
  queue.on("error", (error) => {
    logger.error("BullMQ queue error", { queue: queue.name, error: error.message });
  });
}

const isIdleReminderQuietHours = (now = new Date()) => {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IDLE_REMINDER_TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return hour < 9;
};

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
    { connection: bullmqConnection },
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
    { connection: bullmqConnection },
  );

export type IdleReminderResult =
  | { status: "no-channel" }
  | { status: "channel-unavailable" }
  | { status: "quiet-hours" }
  | { status: "active-game" }
  | { status: "start-reservation" }
  | { status: "recent-game" }
  | { status: "reminded" };

export const runChannelIdleReminder = async (client: Client): Promise<IdleReminderResult> => {
  if (isIdleReminderQuietHours()) {
    return { status: "quiet-hours" };
  }

  const rules = await loadRules();
  if (!rules.gameChannelId) {
    return { status: "no-channel" };
  }

  const channel = await client.channels.fetch(rules.gameChannelId).catch(() => null);
  if (!channel?.isSendable() || !("guild" in channel) || !channel.guild) {
    return { status: "channel-unavailable" };
  }

  const guildId = channel.guild.id;
  const channelId = channel.id;

  if (await getActiveGameState(guildId, channelId)) {
    return { status: "active-game" };
  }

  if (await getStartReservation(guildId, channelId)) {
    return { status: "start-reservation" };
  }

  const rows = await sqlClient`
    SELECT EXISTS (
      SELECT 1
      FROM game g
      JOIN channel c ON c.id = g.channel_id
      WHERE c.discord_channel_id = ${channelId}
        AND g.is_test = false
        AND g.started_at >= now() - interval '1 hour'
    ) AS had_recent_game
  `;
  if (rows[0]?.had_recent_game) {
    return { status: "recent-game" };
  }

  await channel.send(messages.jobs.channelIdleReminder);
  return { status: "reminded" };
};

const claimOnce = async (key: string, ttlSeconds = ONCE_TTL_SECONDS): Promise<boolean> => {
  const result = await redis.set(key, "1", "EX", String(ttlSeconds), "NX");
  return result === "OK";
};

const releaseOnce = async (key: string): Promise<void> => {
  await redis.del(key);
};

const claimDailyJob = async (jobName: string, now = new Date()): Promise<string | null> => {
  const key = keys.dailyJob(jobName, istanbulDayKey(now));
  return (await claimOnce(key)) ? key : null;
};

const resetSchedulerQueue = async (queue: Queue) => {
  await queue.drain(true);
  await Promise.all([queue.clean(0, 10_000, "completed"), queue.clean(0, 10_000, "failed")]);
};

const upsertPollScheduler = async (queue: Queue, schedulerId: string, jobName: string) => {
  await resetSchedulerQueue(queue);
  await queue.upsertJobScheduler(
    schedulerId,
    { every: SCHEDULER_POLL_MS },
    { name: jobName, data: {}, opts: schedulerJobOpts },
  );
};

export const ensureIdleReminderSchedule = async () => {
  await upsertPollScheduler(idleReminderQueue, "channel-idle-reminder", "check-channel-idle");
};

export const startIdleReminderWorker = (client: Client) =>
  new Worker(
    "channel-idle-reminder",
    async () => {
      const hour = idleReminderHour();
      if (hour === null) {
        return { status: "not-slot" };
      }

      const slotKey = keys.idleReminderSlot(istanbulDayKey(), hour);
      if (!(await claimOnce(slotKey))) {
        return { status: "already-sent" };
      }

      return runChannelIdleReminder(client);
    },
    { connection: bullmqConnection },
  );

export const ensurePeriodAwardsSchedule = async () => {
  await upsertPollScheduler(periodAwardsQueue, "period-awards", "finalize-period-awards");
};

export const startPeriodAwardsWorker = (client: Client) =>
  new Worker(
    "period-awards",
    async () => {
      const claimKey = await claimDailyJob("period-awards");
      if (!claimKey) {
        return { skipped: true };
      }

      try {
        const result = await runPeriodAwardsCheck(client);
        logger.info("Period awards check completed", result);
        return result;
      } catch (error) {
        await releaseOnce(claimKey);
        throw error;
      }
    },
    heavyWorkerOpts,
  );

export const ensureAchievementStreakSchedule = async () => {
  await upsertPollScheduler(
    achievementStreakQueue,
    "achievement-streaks",
    "evaluate-achievement-streaks",
  );
};

export const startAchievementStreakWorker = (client: Client) =>
  new Worker(
    "achievement-streaks",
    async () => {
      const claimKey = await claimDailyJob("achievement-streaks");
      if (!claimKey) {
        return { skipped: true };
      }

      try {
        const result = await runDailyAchievementStreaks(client);
        logger.info("Achievement streak check completed", result);
        return result;
      } catch (error) {
        await releaseOnce(claimKey);
        throw error;
      }
    },
    heavyWorkerOpts,
  );

export const closeQueues = async () => {
  await Promise.all([
    multiplierQueue.close(),
    startReservationQueue.close(),
    idleReminderQueue.close(),
    periodAwardsQueue.close(),
    achievementStreakQueue.close(),
  ]);
  try {
    await bullmqConnection.quit();
  } catch {
    bullmqConnection.disconnect();
  }
};

export const logWorkerError = (worker: Worker) => {
  worker.on("failed", (job, error) => {
    logger.error("BullMQ job failed", { jobId: job?.id, name: job?.name, error: error.message });
  });
  worker.on("error", (error) => {
    logger.error("BullMQ worker error", { error: error.message });
  });
};
