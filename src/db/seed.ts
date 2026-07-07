import { env } from "../config/env.ts";
import { sqlClient } from "./client.ts";

export const seedDefaultRules = async () => {
  await sqlClient`
    INSERT INTO rule (game_channel_id, log_channel_id, nominatim_email)
    SELECT ${env.discordGameChannelId ?? null}, ${env.discordLogChannelId ?? null}, ${env.nominatimEmail ?? null}
    WHERE NOT EXISTS (SELECT 1 FROM rule)
  `;
};
