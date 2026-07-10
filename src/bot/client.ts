import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { assertDiscordEnv, env } from "../config/env.ts";
import { migrate } from "../db/migrate.ts";
import { seedDefaultRules } from "../db/seed.ts";
import { logger } from "../util/logger.ts";
import { onMessageCreate } from "./events/message-create.ts";
import { closeDatabase } from "../db/client.ts";
import { closeRedis } from "../redis/client.ts";
import {
  closeQueues,
  ensureIdleReminderSchedule,
  logWorkerError,
  recoverActiveMultiplierJobs,
  recoverStartReservationJobs,
  startIdleReminderWorker,
  startMultiplierWorker,
  startReservationWorker,
} from "../jobs/queues.ts";

export const startBot = async () => {
  assertDiscordEnv();
  await migrate();
  await seedDefaultRules();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  const multiplierWorker = startMultiplierWorker(client);
  const reservationWorker = startReservationWorker(client);
  const idleReminderWorker = startIdleReminderWorker(client);
  logWorkerError(multiplierWorker);
  logWorkerError(reservationWorker);
  logWorkerError(idleReminderWorker);
  await recoverActiveMultiplierJobs();
  await recoverStartReservationJobs();
  await ensureIdleReminderSchedule();

  client.once(Events.ClientReady, (readyClient) => {
    logger.info("Discord bot ready", { tag: readyClient.user.tag });
  });

  client.on(Events.MessageCreate, onMessageCreate(client));

  const shutdown = async () => {
    logger.info("Shutting down");
    multiplierWorker.close().catch(() => undefined);
    reservationWorker.close().catch(() => undefined);
    idleReminderWorker.close().catch(() => undefined);
    await client.destroy();
    await closeQueues().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    await closeDatabase().catch(() => undefined);
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await client.login(env.discordToken);
};
