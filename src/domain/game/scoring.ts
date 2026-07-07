export const calculateReward = (base: number, currentMultiplier: number, gmMultiplier: number) =>
  Math.round(base * currentMultiplier * gmMultiplier);

export const clampMultiplier = (value: number, max: number) =>
  Math.min(max, Number(value.toFixed(2)));

export const calculateGmMultiplier = (milestones: number[], max = 3) => {
  const uniqueMilestones = new Set(
    milestones.filter((milestone) => milestone >= 10 && milestone <= 200),
  );
  return clampMultiplier(1 + uniqueMilestones.size * 0.1, max);
};

export const earnedMilestonesForGuessCount = (guessCount: number) => {
  const milestones: number[] = [];
  for (let milestone = 10; milestone <= 200; milestone += 10) {
    if (guessCount >= milestone) {
      milestones.push(milestone);
    }
  }

  return milestones;
};
