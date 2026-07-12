import { sqlClient } from "../../src/db/client.ts";

export const SIM_DISCORD_PREFIX = "sim_";
export const SIM_LOCATION_URL_PREFIX = "sim://";
export const SIM_PERIOD_KEY_PREFIX = "sim_";

/** Delete all rows created by achievement sims (discord_user_id LIKE 'sim_%'). */
export const cleanupSimData = async () => {
  await sqlClient`
    DELETE FROM player_achievement
    WHERE player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM period_award
    WHERE player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR award_period_id IN (
      SELECT id FROM award_period WHERE period_key LIKE ${`${SIM_PERIOD_KEY_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM award_period
    WHERE period_key LIKE ${`${SIM_PERIOD_KEY_PREFIX}%`}
  `;

  await sqlClient`
    DELETE FROM guess
    WHERE game_id IN (
      SELECT g.id
      FROM game g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE p.discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM player_game
    WHERE game_id IN (
      SELECT g.id
      FROM game g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE p.discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM game_master_milestone
    WHERE player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR game_id IN (
      SELECT g.id
      FROM game g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE p.discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM point_ledger
    WHERE player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR game_id IN (
      SELECT g.id
      FROM game g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE p.discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM multiplier_event
    WHERE game_id IN (
      SELECT g.id
      FROM game g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE p.discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM game
    WHERE game_master_player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
    OR winner_player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM location
    WHERE original_google_maps_url LIKE ${`${SIM_LOCATION_URL_PREFIX}%`}
  `;

  await sqlClient`
    DELETE FROM player_stat
    WHERE player_id IN (
      SELECT id FROM player WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
    )
  `;

  await sqlClient`
    DELETE FROM player
    WHERE discord_user_id LIKE ${`${SIM_DISCORD_PREFIX}%`}
  `;
};
