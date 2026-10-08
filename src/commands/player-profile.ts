import { loadImage } from "@napi-rs/canvas";
import type { GameMode } from "../domain/game/game-mode.ts";
import { toPassportStamps } from "../domain/maps/player-map-renderer.ts";
import { renderProfileCard } from "../domain/maps/profile-card.ts";
import { messages } from "../i18n/messages.ts";
import { countPlayerUnlocksByDiscordId } from "../repositories/achievements-repository.ts";
import { getPlayerProfile } from "../repositories/core-repository.ts";
import { getPlayerMapHistory } from "../repositories/player-map-repository.ts";
import { logger } from "../util/logger.ts";

/** Gold medals per period type, from a `getPlayerProfile` row. */
const periodWinsOf = (profile: Record<string, unknown>) => ({
  daily: Number(profile.daily_wins ?? 0),
  weekly: Number(profile.weekly_wins ?? 0),
  monthly: Number(profile.monthly_wins ?? 0),
  seasonal: Number(profile.seasonal_wins ?? 0),
  yearly: Number(profile.yearly_wins ?? 0),
});

/** The text profile, used when the card cannot be rendered. Undefined if the player is unknown. */
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
    periodWins: periodWinsOf(profile),
  });
};

/** A missing or slow avatar must not block the card; the card then shows the initial. */
const loadAvatar = async (url: string | undefined) => {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return undefined;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    logger.warn("Could not load avatar for profile card", { error: String(error) });
    return undefined;
  }
};

/** The `!profile` card image. Undefined if the player is unknown. */
export const renderPlayerProfileCard = async (
  discordUserId: string,
  mode: GameMode,
  avatarUrl?: string,
) => {
  const [profile, achievementsUnlocked, wins, avatar] = await Promise.all([
    getPlayerProfile(discordUserId, mode),
    countPlayerUnlocksByDiscordId(discordUserId, mode),
    getPlayerMapHistory(discordUserId, "wins", mode),
    loadAvatar(avatarUrl),
  ]);
  if (!profile) {
    return undefined;
  }

  return renderProfileCard({
    mode,
    playerName: profile.display_name,
    avatar,
    points: Number(profile.points_total ?? 0),
    wins: Number(profile.games_won ?? 0),
    participated: Number(profile.games_participated ?? 0),
    gamesStarted: Number(profile.games_started ?? 0),
    guesses: Number(profile.total_guesses ?? 0),
    gmMultiplier: Number(profile.current_gm_multiplier ?? 1),
    medals: {
      gold: Number(profile.gold ?? 0),
      silver: Number(profile.silver ?? 0),
      bronze: Number(profile.bronze ?? 0),
    },
    achievementsUnlocked,
    periodWins: periodWinsOf(profile),
    stamps: toPassportStamps(mode, wins.topLocations),
  });
};
