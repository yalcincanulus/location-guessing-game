import { env } from "../config/env.ts";
import { sqlClient } from "./client.ts";

export const seedDefaultRules = async () => {
  await sqlClient`
    INSERT INTO rule (game_channel_id, log_channel_id, nominatim_email)
    SELECT ${env.discordGameChannelId ?? null}, ${env.discordLogChannelId ?? null}, ${env.nominatimEmail ?? null}
    WHERE NOT EXISTS (SELECT 1 FROM rule)
  `;

  // The rule row usually exists already, so fill the province channel separately.
  if (env.discordProvinceGameChannelId) {
    await sqlClient`
      UPDATE rule
      SET province_game_channel_id = ${env.discordProvinceGameChannelId}, updated_at = now()
      WHERE province_game_channel_id IS NULL
    `;
  }
};
