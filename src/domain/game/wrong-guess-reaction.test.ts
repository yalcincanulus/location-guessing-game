import { describe, expect, test } from "bun:test";
import {
  EASTER_EGG_WRONG_GUESS_REACTION,
  WRONG_GUESS_EASTER_EGG_ODDS,
  WRONG_GUESS_REACTION,
  pickWrongGuessReaction,
} from "./wrong-guess-reaction.ts";

describe("pickWrongGuessReaction", () => {
  test("uses the woman gesturing no emoji when the roll is under 1 in 200", () => {
    expect(pickWrongGuessReaction(() => 0)).toBe(EASTER_EGG_WRONG_GUESS_REACTION);
    expect(pickWrongGuessReaction(() => 1 / WRONG_GUESS_EASTER_EGG_ODDS - Number.EPSILON)).toBe(
      EASTER_EGG_WRONG_GUESS_REACTION,
    );
  });

  test("uses the red X when the roll is 1 in 200 or higher", () => {
    expect(pickWrongGuessReaction(() => 1 / WRONG_GUESS_EASTER_EGG_ODDS)).toBe(
      WRONG_GUESS_REACTION,
    );
    expect(pickWrongGuessReaction(() => 0.5)).toBe(WRONG_GUESS_REACTION);
    expect(pickWrongGuessReaction(() => 0.999)).toBe(WRONG_GUESS_REACTION);
  });

  test("rolls independently on every wrong guess instead of every 200th guess", () => {
    const alwaysEasterEgg = Array.from({ length: 5 }, () => pickWrongGuessReaction(() => 0));
    expect(alwaysEasterEgg).toEqual(Array(5).fill(EASTER_EGG_WRONG_GUESS_REACTION));

    const neverEasterEgg = Array.from({ length: WRONG_GUESS_EASTER_EGG_ODDS }, () =>
      pickWrongGuessReaction(() => 0.5),
    );
    expect(neverEasterEgg).toEqual(Array(WRONG_GUESS_EASTER_EGG_ODDS).fill(WRONG_GUESS_REACTION));
  });
});
