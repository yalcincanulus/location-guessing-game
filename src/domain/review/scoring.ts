export const DEFAULT_MIN_SHARED_GAMES = 5;
export const MIN_SHARED_GAMES_LIMIT = 100;
export const RATE_LIFT = 2;
export const SHAPE_SHARE = 0.5;
export const FAST_MEDIAN_FRACTION = 0.25;
export const NO_BASELINE_MIN_RATE = 0.5;
export const NO_BASELINE_MIN_WINS = 3;
export const SHRINK_STRENGTH = 8;
export const HOST_ONLY_MAX_PARTICIPATED = 1;
export const HOST_ONLY_MAX_WINS = 1;
export const HOST_ONLY_TOP_SHARE = 0.6;
export const HOST_ONLY_MIN_WINS = 3;
export const MULTIPLIER_SNIPE_MIN_AGE_SECONDS = 600;
export const MULTIPLIER_SNIPE_WINDOW_SECONDS = 60;
export const REPEAT_PIN_METERS = 500;
export const MAX_FAST_SECONDS = 86_400;

export type PairStats = {
  playedWith: number;
  winsWith: number;
  playedOther: number;
  winsOther: number;
  silentWins: number;
  fastWins: number;
};

export type PairVerdict = {
  flagged: boolean;
  rateGate: boolean;
  shapeGate: boolean;
  /** Undefined when this player has no games with other hosts. */
  lift: number | undefined;
  withRate: number;
  otherRate: number | undefined;
  silentShare: number;
  fastShare: number;
};

export const evaluatePair = (
  stats: PairStats,
  minShared = DEFAULT_MIN_SHARED_GAMES,
): PairVerdict => {
  const withRate = stats.playedWith === 0 ? 0 : stats.winsWith / stats.playedWith;
  const otherRate = stats.playedOther === 0 ? undefined : stats.winsOther / stats.playedOther;
  const silentShare = stats.winsWith === 0 ? 0 : stats.silentWins / stats.winsWith;
  const fastShare = stats.winsWith === 0 ? 0 : stats.fastWins / stats.winsWith;
  const shapeGate = stats.winsWith > 0 && (silentShare >= SHAPE_SHARE || fastShare >= SHAPE_SHARE);

  let rateGate = false;
  let lift: number | undefined;
  if (stats.playedWith >= minShared && stats.winsWith > 0) {
    if (otherRate === undefined) {
      rateGate = withRate >= NO_BASELINE_MIN_RATE && stats.winsWith >= NO_BASELINE_MIN_WINS;
    } else if (otherRate === 0) {
      rateGate = true;
      lift = Number.POSITIVE_INFINITY;
    } else {
      lift = withRate / otherRate;
      rateGate = lift >= RATE_LIFT;
    }
  }

  return {
    flagged: rateGate && shapeGate,
    rateGate,
    shapeGate,
    lift,
    withRate,
    otherRate,
    silentShare,
    fastShare,
  };
};

export type HostOnlyStats = {
  gamesStarted: number;
  gamesParticipated: number;
  gamesWon: number;
  completedHosted: number;
  topWinnerWins: number;
};

export const evaluateHostOnly = (
  stats: HostOnlyStats,
  minStarted = DEFAULT_MIN_SHARED_GAMES,
): boolean => {
  if (stats.gamesStarted < minStarted) {
    return false;
  }
  if (stats.gamesParticipated > HOST_ONLY_MAX_PARTICIPATED) {
    return false;
  }
  if (stats.gamesWon > HOST_ONLY_MAX_WINS) {
    return false;
  }
  if (stats.completedHosted <= 0 || stats.topWinnerWins < HOST_ONLY_MIN_WINS) {
    return false;
  }
  return stats.topWinnerWins / stats.completedHosted >= HOST_ONLY_TOP_SHARE;
};

export const shrunkRate = (
  wins: number,
  played: number,
  priorRate: number,
  strength = SHRINK_STRENGTH,
) => {
  const prior = Math.min(1, Math.max(0, priorRate));
  return (wins + prior * strength) / (played + strength);
};

export const herfindahl = (counts: number[]) => {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return 0;
  }
  return counts.reduce((sum, count) => sum + (count / total) ** 2, 0);
};

export const isFastSolve = (solveSeconds: number | null, countryMedianSeconds: number | null) => {
  if (solveSeconds == null || countryMedianSeconds == null) {
    return false;
  }
  if (solveSeconds < 0 || countryMedianSeconds <= 0) {
    return false;
  }
  return solveSeconds <= countryMedianSeconds * FAST_MEDIAN_FRACTION;
};

export const parseMinSharedGames = (value: string | undefined) => {
  if (value === undefined || value === "") {
    return DEFAULT_MIN_SHARED_GAMES;
  }
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MIN_SHARED_GAMES_LIMIT) {
    return undefined;
  }
  return parsed;
};

export const parseFastSeconds = (value: string | undefined) => {
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_FAST_SECONDS) {
    return undefined;
  }
  return parsed;
};
