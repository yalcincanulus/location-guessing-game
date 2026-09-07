export const WRONG_GUESS_REACTION = "❌";
export const EASTER_EGG_WRONG_GUESS_REACTION = "🙅‍♀️";
export const WRONG_GUESS_EASTER_EGG_ODDS = 200;

export const pickWrongGuessReaction = (random = Math.random) =>
  random() < 1 / WRONG_GUESS_EASTER_EGG_ODDS
    ? EASTER_EGG_WRONG_GUESS_REACTION
    : WRONG_GUESS_REACTION;
