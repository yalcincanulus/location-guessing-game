export type GuessStreakState = {
  userId: string;
  count: number;
  lastGuessAt: number;
};

export const isRateLimited = (
  streak: GuessStreakState | undefined,
  now: number,
  maxConsecutiveGuesses: number,
  idleResetSeconds: number,
) => {
  if (!streak) {
    return false;
  }

  if (now - streak.lastGuessAt > idleResetSeconds * 1000) {
    return false;
  }

  return streak.count >= maxConsecutiveGuesses;
};

export const nextStreaks = (
  streaks: Record<string, GuessStreakState>,
  userId: string,
  now: number,
  idleResetSeconds: number,
) => {
  const next: Record<string, GuessStreakState> = {};
  for (const [key, streak] of Object.entries(streaks)) {
    if (now - streak.lastGuessAt <= idleResetSeconds * 1000 && key === userId) {
      next[key] = streak;
    }
  }

  next[userId] = {
    userId,
    count: (next[userId]?.count ?? 0) + 1,
    lastGuessAt: now,
  };

  return next;
};
