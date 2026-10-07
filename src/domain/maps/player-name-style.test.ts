import { describe, expect, test } from "bun:test";
import { getPlayerNameStyle, PLAYER_NAME_STYLES } from "./player-name-style.ts";
import type { MapMedalCounts } from "./map-header.ts";

describe("player name medal tiers", () => {
  const cases: Array<[MapMedalCounts, keyof typeof PLAYER_NAME_STYLES]> = [
    [{ gold: 0, silver: 0, bronze: 0 }, "white"],
    [{ gold: 10, silver: 5, bronze: 9 }, "white"],
    [{ gold: 0, silver: 24, bronze: 1 }, "gold"],
    [{ gold: 50, silver: 50, bronze: 49 }, "gold"],
    [{ gold: 0, silver: 100, bronze: 50 }, "rose"],
    [{ gold: 100, silver: 100, bronze: 99 }, "rose"],
    [{ gold: 100, silver: 100, bronze: 100 }, "platinum"],
    [{ gold: 200, silver: 100, bronze: 99 }, "platinum"],
    [{ gold: 0, silver: 250, bronze: 150 }, "explorer"],
    [{ gold: 1000, silver: 0, bronze: 0 }, "explorer"],
  ];
  test.each(cases)("selects %j medals as %s", (medals, tier) => {
    expect(getPlayerNameStyle(medals)).toBe(PLAYER_NAME_STYLES[tier]);
  });
});
