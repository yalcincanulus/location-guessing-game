import { describe, expect, test } from "bun:test";
import { resolveStartSource } from "./start-source.ts";
import {
  evaluateHostOnly,
  evaluatePair,
  herfindahl,
  isFastSolve,
  parseFastSeconds,
  parseMinSharedGames,
  shrunkRate,
} from "./scoring.ts";

const pair = {
  playedWith: 5,
  winsWith: 5,
  playedOther: 20,
  winsOther: 1,
  silentWins: 0,
  fastWins: 0,
};

describe("resolveStartSource", () => {
  test("keeps a single channel and marks a mix as hybrid", () => {
    expect(resolveStartSource("dm", "dm")).toBe("dm");
    expect(resolveStartSource("channel", "channel")).toBe("channel");
    expect(resolveStartSource("dm", "channel")).toBe("hybrid");
    expect(resolveStartSource("channel", undefined)).toBeUndefined();
  });
});

describe("evaluatePair", () => {
  test("requires five shared games", () => {
    const verdict = evaluatePair({ ...pair, playedWith: 4, winsWith: 4, silentWins: 4 });
    expect(verdict.flagged).toBe(false);
  });

  test("flags infinite lift when every silent win is with one host", () => {
    const verdict = evaluatePair({
      ...pair,
      playedOther: 10,
      winsOther: 0,
      silentWins: 3,
    });
    expect(verdict.lift).toBe(Number.POSITIVE_INFINITY);
    expect(verdict.flagged).toBe(true);
  });

  test("keeps a modest lift off the list", () => {
    const verdict = evaluatePair({
      ...pair,
      playedOther: 10,
      winsOther: 6,
      silentWins: 5,
    });
    expect(verdict.rateGate).toBe(false);
    expect(verdict.flagged).toBe(false);
  });

  test("requires half of the wins to be silent or fast", () => {
    const slow = evaluatePair(pair);
    expect(slow.shapeGate).toBe(false);
    expect(slow.flagged).toBe(false);

    const fast = evaluatePair({ ...pair, fastWins: 3 });
    expect(fast.flagged).toBe(true);
  });

  test("uses an absolute rate when the player has no other hosts", () => {
    const thin = evaluatePair({
      ...pair,
      playedOther: 0,
      winsOther: 0,
      winsWith: 2,
      playedWith: 5,
      silentWins: 2,
    });
    expect(thin.rateGate).toBe(false);

    const concentrated = evaluatePair({
      ...pair,
      playedOther: 0,
      winsOther: 0,
      winsWith: 3,
      playedWith: 5,
      silentWins: 2,
    });
    expect(concentrated.lift).toBeUndefined();
    expect(concentrated.flagged).toBe(true);
  });
});

describe("evaluateHostOnly", () => {
  test("flags an account that almost only hosts and feeds one winner", () => {
    expect(
      evaluateHostOnly({
        gamesStarted: 5,
        gamesParticipated: 0,
        gamesWon: 0,
        completedHosted: 5,
        topWinnerWins: 4,
      }),
    ).toBe(true);
  });

  test("ignores accounts that also play", () => {
    expect(
      evaluateHostOnly({
        gamesStarted: 5,
        gamesParticipated: 2,
        gamesWon: 0,
        completedHosted: 5,
        topWinnerWins: 5,
      }),
    ).toBe(false);
  });
});

describe("rates", () => {
  test("shrinks a short win streak toward the community rate", () => {
    expect(shrunkRate(2, 2, 0.2)).toBeCloseTo(0.36);
  });

  test("concentrates when one host supplies every win", () => {
    expect(herfindahl([6, 2, 2])).toBeCloseTo(0.44);
    expect(herfindahl([4])).toBe(1);
    expect(herfindahl([])).toBe(0);
  });

  test("calls a solve fast only against that country's own median", () => {
    expect(isFastSolve(10, 80)).toBe(true);
    expect(isFastSolve(30, 80)).toBe(false);
    expect(isFastSolve(10, null)).toBe(false);
    expect(isFastSolve(10, 0)).toBe(false);
  });
});

describe("review arguments", () => {
  test("parses the shared-game floor", () => {
    expect(parseMinSharedGames(undefined)).toBe(5);
    expect(parseMinSharedGames("8")).toBe(8);
    expect(parseMinSharedGames("0")).toBeUndefined();
    expect(parseMinSharedGames("101")).toBeUndefined();
  });

  test("parses the fast-win window", () => {
    expect(parseFastSeconds("20")).toBe(20);
    expect(parseFastSeconds(undefined)).toBeUndefined();
    expect(parseFastSeconds("86401")).toBeUndefined();
  });
});
