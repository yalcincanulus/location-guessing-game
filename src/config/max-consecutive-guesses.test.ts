import { describe, expect, test } from "bun:test";
import { parseMaxConsecutiveGuesses } from "./max-consecutive-guesses.ts";

describe("parseMaxConsecutiveGuesses", () => {
  test("accepts integers from 1 to 100", () => {
    expect(parseMaxConsecutiveGuesses("1")).toBe(1);
    expect(parseMaxConsecutiveGuesses("6")).toBe(6);
    expect(parseMaxConsecutiveGuesses("100")).toBe(100);
  });

  test("rejects empty, non-digits, zero, and values over 100", () => {
    expect(parseMaxConsecutiveGuesses("")).toBeUndefined();
    expect(parseMaxConsecutiveGuesses("0")).toBeUndefined();
    expect(parseMaxConsecutiveGuesses("101")).toBeUndefined();
    expect(parseMaxConsecutiveGuesses("8.5")).toBeUndefined();
    expect(parseMaxConsecutiveGuesses("-3")).toBeUndefined();
    expect(parseMaxConsecutiveGuesses("6abc")).toBeUndefined();
  });
});
