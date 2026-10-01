import type { Guild, GuildBasedChannel, User } from "discord.js";
import { sqlClient } from "../db/client.ts";
import { discordSnowflakeToDate } from "../util/discord-snowflake.ts";
import { tablesFor, type GameMode } from "../domain/game/game-mode.ts";

export type DbPlayer = {
  id: string;
  discordUserId: string;
  displayName: string;
};

export const upsertPlayer = async (user: User, displayName?: string): Promise<DbPlayer> => {
  const discordCreatedAt = discordSnowflakeToDate(user.id) ?? null;
  const rows = await sqlClient`
    INSERT INTO player (discord_user_id, display_name, discord_created_at, last_seen_at, updated_at)
    VALUES (${user.id}, ${displayName ?? user.displayName ?? user.username}, ${discordCreatedAt}, now(), now())
    ON CONFLICT (discord_user_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      discord_created_at = COALESCE(player.discord_created_at, EXCLUDED.discord_created_at),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id, discord_user_id, display_name
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert player");
  }

  return { id: row.id, discordUserId: row.discord_user_id, displayName: row.display_name };
};

export const findPlayerByDiscordUserId = async (
  discordUserId: string,
): Promise<DbPlayer | undefined> => {
  const rows = await sqlClient`
    SELECT id, discord_user_id, display_name
    FROM player
    WHERE discord_user_id = ${discordUserId}
  `;

  const row = rows[0];
  return row
    ? { id: row.id, discordUserId: row.discord_user_id, displayName: row.display_name }
    : undefined;
};

export const findPlayersByDisplayName = async (displayName: string): Promise<DbPlayer[]> => {
  const name = displayName.trim();
  if (!name) {
    return [];
  }

  const rows = await sqlClient`
    SELECT id, discord_user_id, display_name
    FROM player
    WHERE lower(trim(display_name)) = lower(trim(${name}))
    ORDER BY display_name ASC, discord_user_id ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    discordUserId: row.discord_user_id,
    displayName: row.display_name,
  }));
};

export const ensurePlayerStat = async (playerId: string, mode: GameMode = "country") => {
  await sqlClient`
    INSERT INTO ${sqlClient(tablesFor(mode).playerStat)} (player_id)
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

export const getPlayerProfile = async (discordUserId: string, mode: GameMode = "country") => {
  const t = tablesFor(mode);
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
      ps.max_game_wrong_guess_count_as_gm,
      COALESCE(medals.medal_points, 0)::int AS medal_points,
      COALESCE(medals.gold, 0)::int AS gold,
      COALESCE(medals.silver, 0)::int AS silver,
      COALESCE(medals.bronze, 0)::int AS bronze
    FROM player p
    LEFT JOIN ${sqlClient(t.playerStat)} ps ON ps.player_id = p.id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(pa.medal_points), 0) AS medal_points,
        COUNT(*) FILTER (WHERE pa.medal = 'gold') AS gold,
        COUNT(*) FILTER (WHERE pa.medal = 'silver') AS silver,
        COUNT(*) FILTER (WHERE pa.medal = 'bronze') AS bronze
      FROM ${sqlClient(t.periodAward)} pa
      WHERE pa.player_id = p.id
    ) medals ON true
    WHERE p.discord_user_id = ${discordUserId}
  `;

  return rows[0];
};

export const getLeaderboard = async (
  kind: "points" | "wins" | "started" | "hardest",
  limit = 10,
  mode: GameMode = "country",
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
      FROM ${tablesFor(mode).playerStat} ps
      JOIN player p ON p.id = ps.player_id
      WHERE ps.${orderColumn} > 0
      ORDER BY ps.${orderColumn} DESC, p.display_name ASC
      LIMIT $1
    `,
    [limit],
  );
};

export const getWinRateLeaderboard = async (mode: GameMode = "country") => {
  const rows = await sqlClient`
    SELECT
      p.display_name,
      p.discord_user_id,
      ps.games_won,
      ps.games_participated,
      ps.games_won::numeric / ps.games_participated AS win_rate
    FROM ${sqlClient(tablesFor(mode).playerStat)} ps
    JOIN player p ON p.id = ps.player_id
    WHERE ps.games_participated > 0
    ORDER BY win_rate DESC, ps.games_participated DESC, p.display_name ASC, p.discord_user_id ASC
    LIMIT 20
  `;

  return rows.map((row) => ({
    displayName: String(row.display_name),
    discordUserId: String(row.discord_user_id),
    wins: Number(row.games_won),
    played: Number(row.games_participated),
    winRate: Number(row.win_rate),
  }));
};
