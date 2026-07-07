import type { Guild, GuildBasedChannel, User } from "discord.js";
import { sqlClient } from "../db/client.ts";

export type DbPlayer = {
  id: string;
  discordUserId: string;
  displayName: string;
};

export const upsertPlayer = async (user: User, displayName?: string): Promise<DbPlayer> => {
  const rows = await sqlClient`
    INSERT INTO player (discord_user_id, display_name, last_seen_at, updated_at)
    VALUES (${user.id}, ${displayName ?? user.displayName ?? user.username}, now(), now())
    ON CONFLICT (discord_user_id)
    DO UPDATE SET display_name = EXCLUDED.display_name, last_seen_at = now(), updated_at = now()
    RETURNING id, discord_user_id, display_name
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert player");
  }

  return { id: row.id, discordUserId: row.discord_user_id, displayName: row.display_name };
};

export const ensurePlayerStat = async (playerId: string) => {
  await sqlClient`
    INSERT INTO player_stat (player_id)
    VALUES (${playerId})
    ON CONFLICT (player_id) DO NOTHING
  `;
};

export const upsertGuild = async (guild: Guild) => {
  const rows = await sqlClient`
    INSERT INTO guild (discord_guild_id, name, updated_at)
    VALUES (${guild.id}, ${guild.name}, now())
    ON CONFLICT (discord_guild_id)
    DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id
  `;
  return rows[0]?.id as string | undefined;
};

export const upsertChannel = async (channel: GuildBasedChannel, guildId?: string) => {
  const rows = await sqlClient`
    INSERT INTO channel (guild_id, discord_channel_id, name, kind, updated_at)
    VALUES (${guildId ?? null}, ${channel.id}, ${"name" in channel ? channel.name : "game"}, 'game', now())
    ON CONFLICT (discord_channel_id)
    DO UPDATE SET name = EXCLUDED.name, guild_id = EXCLUDED.guild_id, updated_at = now()
    RETURNING id
  `;
  return rows[0]?.id as string | undefined;
};

export const getPlayerProfile = async (discordUserId: string) => {
  const rows = await sqlClient`
    SELECT
      p.display_name,
      ps.games_started,
      ps.games_participated,
      ps.games_won,
      ps.total_guesses,
      ps.correct_guesses,
      ps.wrong_guesses,
      ps.repeat_guesses,
      ps.points_total,
      ps.best_single_game_points,
      ps.current_gm_multiplier,
      ps.max_game_wrong_guess_count_as_gm
    FROM player p
    LEFT JOIN player_stat ps ON ps.player_id = p.id
    WHERE p.discord_user_id = ${discordUserId}
  `;

  return rows[0];
};

export const getLeaderboard = async (
  kind: "points" | "wins" | "started" | "hardest",
  limit = 10,
) => {
  const orderColumn =
    kind === "points"
      ? "points_total"
      : kind === "wins"
        ? "games_won"
        : kind === "started"
          ? "games_started"
          : "max_game_wrong_guess_count_as_gm";

  return sqlClient.unsafe(
    `
      SELECT p.display_name, p.discord_user_id, ps.${orderColumn} AS value
      FROM player_stat ps
      JOIN player p ON p.id = ps.player_id
      ORDER BY ps.${orderColumn} DESC, p.display_name ASC
      LIMIT $1
    `,
    [limit],
  );
};
