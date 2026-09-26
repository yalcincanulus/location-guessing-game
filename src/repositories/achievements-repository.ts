import { sqlClient } from "../db/client.ts";
import { ONESHOT_TIER } from "../domain/achievements/catalog.ts";
import { tablesFor, type GameMode } from "../domain/game/game-mode.ts";

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
  mode: GameMode = "country",
): Promise<StoredUnlock[]> => {
  const table = sqlClient(tablesFor(mode).playerAchievement);
  const inserted: StoredUnlock[] = [];
  for (const unlock of unlocks) {
    const earnedAt = unlock.earnedAt ?? new Date();
    const rows = await sqlClient`
      INSERT INTO ${table} (
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

export const getPlayerUnlocks = async (playerId: string, mode: GameMode = "country") => {
  const table = sqlClient(tablesFor(mode).playerAchievement);
  const rows = await sqlClient`
    SELECT achievement_id, tier, earned_at, source_game_id, meta
    FROM ${table}
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

export const countPlayerUnlocks = async (playerId: string, mode: GameMode = "country") => {
  const table = sqlClient(tablesFor(mode).playerAchievement);
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM ${table}
    WHERE player_id = ${playerId}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const countPlayerUnlocksByDiscordId = async (
  discordUserId: string,
  mode: GameMode = "country",
) => {
  const table = sqlClient(tablesFor(mode).playerAchievement);
  const rows = await sqlClient`
    SELECT COUNT(*)::int AS value
    FROM ${table} pa
    JOIN player p ON p.id = pa.player_id
    WHERE p.discord_user_id = ${discordUserId}
  `;
  return Number(rows[0]?.value ?? 0);
};

export const getOwnedTiers = async (
  playerId: string,
  achievementId: string,
  mode: GameMode = "country",
) => {
  const table = sqlClient(tablesFor(mode).playerAchievement);
  const rows = await sqlClient`
    SELECT tier
    FROM ${table}
    WHERE player_id = ${playerId}
      AND achievement_id = ${achievementId}
  `;
  return new Set(rows.map((row) => Number(row.tier)));
};

export const hasOneshot = async (
  playerId: string,
  achievementId: string,
  mode: GameMode = "country",
) => {
  const owned = await getOwnedTiers(playerId, achievementId, mode);
  return owned.has(ONESHOT_TIER);
};

export const listAllPlayerIds = async () => {
  const rows = await sqlClient`
    SELECT id FROM player ORDER BY first_seen_at ASC
  `;
  return rows.map((row) => String(row.id));
};
