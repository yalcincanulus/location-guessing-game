import Redis from "ioredis";
import { env } from "../config/env.ts";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

export const closeRedis = async () => {
  await redis.quit();
};
