import Redis from "ioredis";
import { env } from "../config/env.ts";
import { logger } from "../util/logger.ts";

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

let warnedAboutIpHost = false;

export const createRedisConnection = (connectionName: string) => {
  const hostname = new URL(env.redisUrl).hostname;
  if (!warnedAboutIpHost && IPV4.test(hostname)) {
    warnedAboutIpHost = true;
    logger.warn(
      "REDIS_URL uses a raw IP; reconnects will fail if the Redis container gets a new address. Prefer the service hostname.",
      { connectionName },
    );
  }

  const client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    connectionName,
    keepAlive: 10_000,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });
  client.on("error", (error) => {
    logger.error("Redis connection error", { connectionName, error: error.message });
  });
  return client;
};

export const redis = createRedisConnection("app");

const quitOrDisconnect = async (client: Redis) => {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};

export const closeRedis = async () => {
  await quitOrDisconnect(redis);
};
