import type { GuildMember, Message } from "discord.js";
import type { GameRules } from "../config/rules.ts";

export const hasVerifiedRole = (member: GuildMember | null, rules: GameRules) => {
  if (!member) {
    return false;
  }

  if (rules.verifiedRoleId && member.roles.cache.has(rules.verifiedRoleId)) {
    return true;
  }

  return member.roles.cache.some(
    (role) => role.name.toLocaleLowerCase("tr") === rules.verifiedRoleName.toLocaleLowerCase("tr"),
  );
};

export const isConfiguredGameChannel = (message: Message, rules: GameRules) =>
  !rules.gameChannelId || message.channel.id === rules.gameChannelId;
