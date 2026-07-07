import type { GameRules } from "../../config/rules.ts";
import type { ActiveGameState } from "./active-game-state.ts";

export const canBypassGameMasterBlock = (
  state: Pick<ActiveGameState, "isTest">,
  channelId: string,
  discordUserId: string,
  rules: GameRules,
) =>
  state.isTest &&
  rules.testModeEnabled &&
  rules.testChannelId === channelId &&
  rules.testAdminUserIds.includes(discordUserId);
