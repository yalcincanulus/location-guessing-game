import { sqlClient } from "../db/client.ts";
import { ONESHOT_TIER } from "../domain/achievements/catalog.ts";

export type AchievementUnlockInsert = {
  playerId: string;
  achievementId: string;
  tier: number;
  earnedAt?: Date;
  sourceGameId?: string | null;
  meta?: Record<string, unknown> | null;
};

export type StoredUnlock = {
  playerId: string;
  achievementId: string;
  tier: number;
  earnedAt: Date;
  sourceGameId: string | null;
  meta: Record<string, unknown> | null;
};

export const insertUnlocks = async (
  unlocks: AchievementUnlockInsert[],
): Promise<StoredUnlock[]> => {
  const inserted: StoredUnlock[] = [];
  for (const unlock of unlocks) {
    const earnedAt = unlock.earnedAt ?? new Date();
    const rows = await sqlClient`
      INSERT INTO player_achievement (
        player_id,
        achievement_id,
        tier,
        earned_at,
        source_game_id,
        meta
      )
      VALUES (
        ${unlock.playerId},
        ${unlock.achievementId},
        ${unlock.tier},
        ${earnedAt.toISOString()},
        ${unlock.sourceGameId ?? null},
        ${unlock.meta ? JSON.stringify(unlock.meta) : null}
      )
      ON CONFLICT (player_id, achievement_id, tier) DO NOTHING
      RETURNING player_id, achievement_id, tier, earned_at, source_game_id, meta
    `;
    const row = rows[0];
    if (row) {
      inserted.push({
        playerId: String(row.player_id),
        achievementId: String(row.achievement_id),
        tier: Number(row.tier),
        earnedAt: new Date(row.earned_at as string | Date),
        sourceGameId: row.source_game_id ? String(row.source_game_id) : null,
        meta: (row.meta as Record<string, unknown> | null) ?? null,
      });
    }
  }
  return inserted;
};

export const getPlayerUnlocks = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT achievement_id, tier, earned_at, source_game_id, meta
    FROM player_achievement
    WHERE player_id = ${playerId}
    ORDER BY earned_at ASC
  `;
  return rows.map((row) => ({
    achievementId: String(row.achievement_id),
    tier: Number(row.tier),
    earnedAt: new Date(row.earned_at as string | Date),
    sourceGameId: row.source_game_id ? String(row.source_game_id) : null,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
  }));
};

export const countPlayerUnlocks = async (playerId: string) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM player_achievement
    WHERE player_id = ${playerId}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const countPlayerUnlocksByDiscordId = async (discordUserId: string) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM player_achievement pa
    JOIN player p ON p.id = pa.player_id
    WHERE p.discord_user_id = ${discordUserId}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getOwnedTiers = async (playerId: string, achievementId: string) => {
  const rows = await sqlClient`
    SELECT tier
    FROM player_achievement
    WHERE player_id = ${playerId}
      AND achievement_id = ${achievementId}
  `;
  return new Set(rows.map((row) => Number(row.tier)));
};

export const hasOneshot = async (playerId: string, achievementId: string) => {
  const owned = await getOwnedTiers(playerId, achievementId);
  return owned.has(ONESHOT_TIER);
};

export const listAllPlayerIds = async () => {
  const rows = await sqlClient`
    SELECT id FROM player ORDER BY first_seen_at ASC
  `;
  return rows.map((row) => String(row.id));
};
