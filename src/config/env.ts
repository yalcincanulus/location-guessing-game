const optional = (name: string) => {
  const value = Bun.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const required = (name: string) => {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  discordToken: optional("DISCORD_TOKEN"),
  discordClientId: optional("DISCORD_CLIENT_ID"),
  discordGuildId: optional("DISCORD_GUILD_ID"),
  discordGameChannelId: optional("DISCORD_GAME_CHANNEL_ID"),
  discordLogChannelId: optional("DISCORD_LOG_CHANNEL_ID"),
  nominatimUserAgent:
    optional("NOMINATIM_USER_AGENT") ?? "location-guessing-game/0.1 (+https://discord.com)",
  nominatimEmail: optional("NOMINATIM_EMAIL"),
  nodeEnv: optional("NODE_ENV") ?? "development",
};

export const assertDiscordEnv = () => {
  if (!env.discordToken) {
    throw new Error("DISCORD_TOKEN is required to start the bot");
  }
};
