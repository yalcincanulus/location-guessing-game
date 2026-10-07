import type { GameMode } from "../domain/game/game-mode.ts";
import { messages } from "../i18n/messages.ts";
import { countPlayerUnlocksByDiscordId } from "../repositories/achievements-repository.ts";
import { getPlayerProfile } from "../repositories/core-repository.ts";

/** The `!profile` text for one player, without the mode label. Undefined if the player is unknown. */
export const formatPlayerProfile = async (discordUserId: string, mode: GameMode) => {
  const [profile, achievementsUnlocked] = await Promise.all([
    getPlayerProfile(discordUserId, mode),
    countPlayerUnlocksByDiscordId(discordUserId, mode),
  ]);
  if (!profile) {
    return undefined;
  }

  const participated = Number(profile.games_participated ?? 0);
  const wins = Number(profile.games_won ?? 0);
  const winRate = participated === 0 ? 0 : Math.round((wins / participated) * 100);
  return messages.commands.profile({
    displayName: profile.display_name,
    points: profile.points_total ?? 0,
    wins,
    participated,
    winRate,
    gamesStarted: profile.games_started ?? 0,
    guesses: profile.total_guesses ?? 0,
    gmMultiplier: Number(profile.current_gm_multiplier ?? 1),
    medalPoints: Number(profile.medal_points ?? 0),
    gold: Number(profile.gold ?? 0),
    silver: Number(profile.silver ?? 0),
    bronze: Number(profile.bronze ?? 0),
    achievementsUnlocked,
  });
};
