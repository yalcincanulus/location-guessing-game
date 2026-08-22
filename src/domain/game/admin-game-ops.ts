import type { User } from "discord.js";
import { sqlClient } from "../../db/client.ts";
import { upsertPlayer } from "../../repositories/core-repository.ts";
import { cancelStartReservationExpiry, removeMultiplierJobsForGame } from "../../jobs/queues.ts";
import { clearGameKeys, getActiveGameState, type ActiveGameState } from "./active-game-state.ts";
import {
  clearPendingStart,
  clearStartReservation,
  getStartReservation,
} from "./start-reservation.ts";

export type ActiveDbGame = {
  gameId: string;
  status: string;
  isTest: boolean;
  gameMasterDiscordUserId: string;
  countryCode: string;
  countryName?: string;
  regionName?: string;
  latitude: number;
  longitude: number;
  currentMultiplier: number;
};

export type ActiveGameContext = {
  state?: ActiveGameState;
  dbGame?: ActiveDbGame;
  redisMissingButDbActive: boolean;
};

export const getActiveDbGame = async (channelId: string): Promise<ActiveDbGame | undefined> => {
  const rows = await sqlClient`
    SELECT
      g.id AS game_id,
      g.status,
      g.is_test,
      gm.discord_user_id AS game_master_discord_user_id,
      l.country_code,
      l.country_name,
      l.region_name,
      l.latitude,
      l.longitude,
      g.current_multiplier_final
    FROM game g
    JOIN channel c ON c.id = g.channel_id
    JOIN location l ON l.id = g.location_id
    JOIN player gm ON gm.id = g.game_master_player_id
    WHERE c.discord_channel_id = ${channelId}
      AND g.status = 'active'
    ORDER BY g.started_at DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    gameId: row.game_id,
    status: row.status,
    isTest: row.is_test,
    gameMasterDiscordUserId: row.game_master_discord_user_id,
    countryCode: row.country_code,
    countryName: row.country_name ?? undefined,
    regionName: row.region_name ?? undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    currentMultiplier: Number(row.current_multiplier_final),
  };
};

export const getActiveGameContext = async (
  guildId: string,
  channelId: string,
): Promise<ActiveGameContext> => {
  const state = await getActiveGameState(guildId, channelId);
  const dbGame = await getActiveDbGame(channelId);
  return {
    state,
    dbGame,
    redisMissingButDbActive: !state && Boolean(dbGame),
  };
};

export type CancelOrFailResult =
  | { ok: true; gameId: string }
  | { ok: false; reason: "no-active-game" };

export const cancelOrFailActiveGame = async ({
  guildId,
  channelId,
  status,
  reason,
  cancelledBy,
  displayName,
}: {
  guildId: string;
  channelId: string;
  status: "cancelled" | "failed";
  reason: string;
  cancelledBy: User;
  displayName?: string;
}): Promise<CancelOrFailResult> => {
  const { state, dbGame } = await getActiveGameContext(guildId, channelId);
  const gameId = state?.gameId ?? dbGame?.gameId;
  if (!gameId) {
    return { ok: false, reason: "no-active-game" };
  }

  const player = await upsertPlayer(cancelledBy, displayName);
  await sqlClient`
    UPDATE game
    SET
      status = ${status},
      ended_at = now(),
      cancel_reason = ${reason},
      cancelled_by_player_id = ${player.id},
      updated_at = now()
    WHERE id = ${gameId}
      AND status = 'active'
  `;

  await clearGameKeys(guildId, channelId, gameId);
  await removeMultiplierJobsForGame(gameId);
  return { ok: true, gameId };
};

export type ClearStartResult =
  | { ok: true; hadReservation: boolean; hadPending: boolean }
  | { ok: false; reason: "no-start-state" };

export const clearChannelStartState = async (
  guildId: string,
  channelId: string,
): Promise<ClearStartResult> => {
  const reservation = await getStartReservation(guildId, channelId);
  if (!reservation) {
    await cancelStartReservationExpiry(guildId, channelId);
    return { ok: false, reason: "no-start-state" };
  }

  await clearPendingStart(reservation.pendingKey);
  await cancelStartReservationExpiry(guildId, channelId);
  await clearStartReservation(guildId, channelId);
  return { ok: true, hadReservation: true, hadPending: true };
};
