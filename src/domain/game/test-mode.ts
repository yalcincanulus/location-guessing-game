import { isTestChannel, type GameRules } from "../../config/rules.ts";
import type { ActiveGameState } from "./active-game-state.ts";

export const canBypassGameMasterBlock = (
  state: Pick<ActiveGameState, "isTest">,
  channelId: string,
  discordUserId: string,
  rules: GameRules,
) =>
  state.isTest && isTestChannel(channelId, rules) && rules.testAdminUserIds.includes(discordUserId);
