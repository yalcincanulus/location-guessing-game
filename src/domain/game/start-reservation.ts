import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";

export type StartReservationMissing = "screenshot" | "link";

export type StartReservation = {
  userId: string;
  missing: StartReservationMissing;
  pendingKey: string;
};

export const getStartReservation = async (
  guildId: string,
  channelId: string,
): Promise<StartReservation | undefined> => {
  const raw = await redis.get(keys.startReservation(guildId, channelId));
  return raw ? (JSON.parse(raw) as StartReservation) : undefined;
};

export const tryClaimStartReservation = async (
  guildId: string,
  channelId: string,
  reservation: StartReservation,
  ttlSeconds: number,
): Promise<"claimed" | "owned" | "blocked"> => {
  const key = keys.startReservation(guildId, channelId);
  const payload = JSON.stringify(reservation);
  const result = await redis.set(key, payload, "EX", ttlSeconds, "NX");
  if (result === "OK") {
    return "claimed";
  }

  const existing = await getStartReservation(guildId, channelId);
  if (existing?.userId === reservation.userId) {
    return "owned";
  }

  return "blocked";
};

export const updateStartReservation = async (
  guildId: string,
  channelId: string,
  reservation: StartReservation,
): Promise<boolean> => {
  const key = keys.startReservation(guildId, channelId);
  const ttl = await redis.ttl(key);
  if (ttl <= 0) {
    return false;
  }

  const existing = await getStartReservation(guildId, channelId);
  if (!existing || existing.userId !== reservation.userId) {
    return false;
  }

  await redis.set(key, JSON.stringify(reservation), "EX", ttl);
  return true;
};

export const clearStartReservation = async (guildId: string, channelId: string) => {
  await redis.del(keys.startReservation(guildId, channelId));
};

export const clearPendingStart = async (pendingKey: string) => {
  await redis.del(pendingKey, keys.pendingScreenshot(pendingKey));
};
