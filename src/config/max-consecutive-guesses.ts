export const MIN_MAX_CONSECUTIVE_GUESSES = 1;
export const MAX_MAX_CONSECUTIVE_GUESSES = 100;

export const parseMaxConsecutiveGuesses = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_MAX_CONSECUTIVE_GUESSES ||
    parsed > MAX_MAX_CONSECUTIVE_GUESSES
  ) {
    return undefined;
  }
  return parsed;
};
