import { sqlClient } from "../db/client.ts";
import { tablesFor, type GameMode } from "../domain/game/game-mode.ts";
import type { PlayerMapKind } from "../domain/maps/player-map-renderer.ts";
import type { Sql, TransactionSql } from "postgres";

export type PlayerMapHistory = {
  locationCodes: string[];
  gameCount: number;
};

/** Only finished rounds are public: an active host map would expose the answer. */
export const getPlayerMapHistory = async (
  discordUserId: string,
  kind: PlayerMapKind,
  mode: GameMode,
  sql: Sql | TransactionSql = sqlClient,
): Promise<PlayerMapHistory> => {
  const targetCode =
    mode === "province"
      ? sql`g.target_province_code`
      : sql`COALESCE(l.manual_country_code, l.country_code)`;
  const playerColumn = kind === "wins" ? "winner_player_id" : "game_master_player_id";
  const statusFilter =
    kind === "wins"
      ? sql`g.status = 'completed'`
      : sql`g.status IN ('completed', 'cancelled', 'failed')`;
  const rows = await sql`
    SELECT ${targetCode} AS location_code, COUNT(*)::int AS game_count
    FROM ${sql(tablesFor(mode).game)} g
    JOIN location l ON l.id = g.location_id
    JOIN player p ON p.id = g.${sql(playerColumn)}
    WHERE p.discord_user_id = ${discordUserId}
      AND g.is_test = false
      AND ${statusFilter}
    GROUP BY 1
    ORDER BY 1
  `;
  return {
    locationCodes: rows.map((row) => String(row.location_code)),
    gameCount: rows.reduce((total, row) => total + Number(row.game_count), 0),
  };
};
