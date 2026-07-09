import { env } from "../config/env.ts";

export const isBotAdmin = (userId: string) =>
  Boolean(env.discordAdminUserId && env.discordAdminUserId === userId);
