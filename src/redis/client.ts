import { RedisClient } from "bun";
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

  const client = new RedisClient(env.redisUrl, {
    autoReconnect: true,
    enableOfflineQueue: true,
  });

  const applyConnectionName = () => {
    void client.send("CLIENT", ["SETNAME", connectionName]).catch(() => undefined);
  };

  client.onconnect = applyConnectionName;
  client.onclose = (error) => {
    logger.error("Redis connection closed", {
      connectionName,
      error: error?.message,
    });
  };

  return client;
};

export const redis = createRedisConnection("app");

export const closeRedis = async () => {
  // Bun 1.4 throws if onclose is null/undefined when close() runs.
  redis.onclose = () => {};
  try {
    redis.close();
  } catch {
    // already closed
  }
};
