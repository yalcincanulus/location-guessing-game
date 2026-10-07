import { describe, expect, test } from "bun:test";
import { getPlayerNameStyle, PLAYER_NAME_STYLES } from "./player-name-style.ts";
import type { MapMedalCounts } from "./map-header.ts";

describe("player name medal point tiers", () => {
  const cases: Array<[MapMedalCounts, keyof typeof PLAYER_NAME_STYLES]> = [
    [{ gold: 0, silver: 0, bronze: 0 }, "white"],
    [{ gold: 1, silver: 3, bronze: 0 }, "white"],
    [{ gold: 2, silver: 2, bronze: 0 }, "gold"],
    [{ gold: 10, silver: 4, bronze: 1 }, "gold"],
    [{ gold: 0, silver: 20, bronze: 0 }, "rose"],
    [{ gold: 30, silver: 14, bronze: 1 }, "rose"],
    [{ gold: 0, silver: 0, bronze: 120 }, "platinum"],
    [{ gold: 50, silver: 24, bronze: 1 }, "platinum"],
    [{ gold: 50, silver: 25, bronze: 0 }, "explorer"],
    [{ gold: 1000, silver: 0, bronze: 0 }, "explorer"],
  ];
  test.each(cases)("selects %j medals as %s", (medals, tier) => {
    expect(getPlayerNameStyle(medals)).toBe(PLAYER_NAME_STYLES[tier]);
  });
});
