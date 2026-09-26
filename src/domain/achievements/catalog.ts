import type { PeriodType } from "../awards/periods.ts";
import type { GameMode } from "../game/game-mode.ts";

export type AchievementTrack = "host" | "guesser" | "hybrid" | "geography" | "rare";
export type AchievementKind = "ladder" | "oneshot";
export type AchievementEvalOn = "game_started" | "game_completed" | "award_finalized" | "daily_job";

export type AchievementDefinition = {
  id: string;
  track: AchievementTrack;
  kind: AchievementKind;
  /** Ladder thresholds. Empty for oneshots. Multiplier ladders use hundredths (130 = 1.30x). */
  tiers: number[];
  /** Minimum tier that posts to the game channel. Oneshots/rares use 0 to always channel (except guess_first). */
  channelFrom: number | null;
  hiddenUntilEarn: boolean;
  evalOn: AchievementEvalOn[];
  /** When true, always channel-announce (rares). Overrides channelFrom for oneshots. */
  alwaysChannel?: boolean;
  /** Force DM-only even if rare-like. */
  dmOnly?: boolean;
};

/** Oneshot sentinel tier stored in DB. */
export const ONESHOT_TIER = 0;

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  // Host
  {
    id: "host_games",
    track: "host",
    kind: "ladder",
    tiers: [1, 10, 25, 50, 100, 250, 500],
    channelFrom: 50,
    hiddenUntilEarn: false,
    evalOn: ["game_started", "daily_job"],
  },
  {
    id: "host_hard",
    track: "host",
    kind: "ladder",
    tiers: [25, 50, 75, 100, 150, 200],
    channelFrom: 100,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "host_milestones",
    track: "host",
    kind: "ladder",
    tiers: [1, 5, 10, 15, 20],
    channelFrom: 10,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "host_crowd",
    track: "host",
    kind: "ladder",
    tiers: [5, 8, 12, 20],
    channelFrom: 12,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "host_multiplier",
    track: "host",
    kind: "ladder",
    tiers: [130, 150, 180, 200],
    channelFrom: 180,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "host_streak_days",
    track: "host",
    kind: "ladder",
    tiers: [3, 7, 14, 30],
    channelFrom: 14,
    hiddenUntilEarn: false,
    evalOn: ["game_started", "daily_job"],
  },
  {
    id: "host_countries",
    track: "host",
    kind: "ladder",
    tiers: [5, 15, 30, 50, 80],
    channelFrom: 30,
    hiddenUntilEarn: false,
    evalOn: ["game_started", "daily_job"],
  },
  // Guesser
  {
    id: "guess_first",
    track: "guesser",
    kind: "oneshot",
    tiers: [],
    channelFrom: null,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
    dmOnly: true,
  },
  {
    id: "play_games",
    track: "guesser",
    kind: "ladder",
    tiers: [1, 10, 25, 50, 100, 250, 500],
    channelFrom: 50,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "win_games",
    track: "guesser",
    kind: "ladder",
    tiers: [1, 5, 10, 25, 50, 100, 250],
    channelFrom: 50,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "points_total",
    track: "guesser",
    kind: "ladder",
    tiers: [500, 2000, 5000, 10000, 25000, 50000, 100000],
    channelFrom: 10000,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "points_single",
    track: "guesser",
    kind: "ladder",
    tiers: [150, 200, 300, 400, 500],
    channelFrom: 300,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "guess_volume",
    track: "guesser",
    kind: "ladder",
    tiers: [50, 200, 500, 1000, 2500, 5000],
    channelFrom: 1000,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "play_streak_days",
    track: "guesser",
    kind: "ladder",
    tiers: [3, 7, 14, 30],
    channelFrom: 14,
    hiddenUntilEarn: false,
    evalOn: ["game_completed", "daily_job"],
  },
  {
    id: "clutch_win",
    track: "guesser",
    kind: "ladder",
    tiers: [25, 50, 75, 100, 150],
    channelFrom: 100,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "oneshot_win",
    track: "rare",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: true,
    evalOn: ["game_completed"],
    alwaysChannel: true,
  },
  {
    id: "comeback_win",
    track: "guesser",
    kind: "ladder",
    tiers: [10, 20, 35, 50],
    channelFrom: 35,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "first_blood",
    track: "guesser",
    kind: "ladder",
    tiers: [1, 5, 15],
    channelFrom: 5,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  // Hybrid
  {
    id: "dual_threat",
    track: "hybrid",
    kind: "ladder",
    tiers: [5, 15, 30, 50],
    channelFrom: 15,
    hiddenUntilEarn: false,
    evalOn: ["game_started", "game_completed"],
  },
  {
    id: "medalist_daily",
    track: "hybrid",
    kind: "ladder",
    tiers: [1, 5, 15, 30, 60],
    channelFrom: 15,
    hiddenUntilEarn: false,
    evalOn: ["award_finalized"],
  },
  {
    id: "medalist_weekly",
    track: "hybrid",
    kind: "ladder",
    tiers: [1, 3, 8, 15],
    channelFrom: 3,
    hiddenUntilEarn: false,
    evalOn: ["award_finalized"],
  },
  {
    id: "medalist_monthly",
    track: "hybrid",
    kind: "ladder",
    tiers: [1, 3, 6, 12],
    channelFrom: 1,
    hiddenUntilEarn: false,
    evalOn: ["award_finalized"],
  },
  {
    id: "medalist_seasonal",
    track: "hybrid",
    kind: "ladder",
    tiers: [1, 2, 4, 8],
    channelFrom: 1,
    hiddenUntilEarn: false,
    evalOn: ["award_finalized"],
  },
  {
    id: "medalist_yearly",
    track: "hybrid",
    kind: "ladder",
    tiers: [1, 2, 3],
    channelFrom: 1,
    hiddenUntilEarn: false,
    evalOn: ["award_finalized"],
  },
  // Geography
  {
    id: "win_countries",
    track: "geography",
    kind: "ladder",
    tiers: [5, 15, 30, 50, 80],
    channelFrom: 15,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "win_same_country",
    track: "geography",
    kind: "ladder",
    tiers: [3, 5, 10, 20],
    channelFrom: 10,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "territory_win",
    track: "geography",
    kind: "ladder",
    tiers: [1, 3, 5, 10],
    channelFrom: 3,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
  },
  {
    id: "continent_tour",
    track: "geography",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: false,
    evalOn: ["game_completed"],
    alwaysChannel: true,
  },
  // Rare
  {
    id: "multiplier_thief",
    track: "rare",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: true,
    evalOn: ["game_completed"],
    alwaysChannel: true,
  },
  {
    id: "patient_zero",
    track: "rare",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: true,
    evalOn: ["game_completed"],
    alwaysChannel: true,
  },
  {
    id: "night_owl",
    track: "rare",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: true,
    evalOn: ["game_started", "game_completed"],
    alwaysChannel: true,
  },
  {
    id: "early_bird",
    track: "rare",
    kind: "oneshot",
    tiers: [],
    channelFrom: 0,
    hiddenUntilEarn: true,
    evalOn: ["game_started", "game_completed"],
    alwaysChannel: true,
  },
];

/**
 * Achievements that only make sense with world geography. Province games cannot
 * reach 100 unique wrong guesses either (81 provinces), so Patient Zero is out.
 */
const COUNTRY_ONLY_ACHIEVEMENTS = new Set(["territory_win", "continent_tour", "patient_zero"]);

export const isAchievementInMode = (achievementId: string, mode: GameMode) =>
  mode === "country" || !COUNTRY_ONLY_ACHIEVEMENTS.has(achievementId);

export const catalogForMode = (mode: GameMode) =>
  ACHIEVEMENT_CATALOG.filter((item) => isAchievementInMode(item.id, mode));

export const achievementById = new Map(ACHIEVEMENT_CATALOG.map((item) => [item.id, item]));

export const medalistAchievementId = (periodType: PeriodType) => `medalist_${periodType}`;

export const crossedTiers = (tiers: number[], value: number) =>
  tiers.filter((tier) => value >= tier);

export const isChannelNotable = (definition: AchievementDefinition, tier: number) => {
  if (definition.dmOnly) {
    return false;
  }
  if (definition.alwaysChannel) {
    return true;
  }
  if (definition.channelFrom === null) {
    return false;
  }
  return tier >= definition.channelFrom;
};
