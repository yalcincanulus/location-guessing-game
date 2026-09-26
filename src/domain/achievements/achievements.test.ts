import { describe, expect, test } from "bun:test";
import {
  achievementById,
  catalogForMode,
  crossedTiers,
  isAchievementInMode,
  isChannelNotable,
  ONESHOT_TIER,
} from "./catalog.ts";
import { computeStreakFromDates } from "./metrics.ts";
import {
  CONTINENTS,
  continentForCountry,
  hasAllContinents,
  isTerritoryCountry,
} from "./geography.ts";

describe("crossedTiers", () => {
  test("returns all tiers at or below value", () => {
    expect(crossedTiers([1, 10, 25, 50], 25)).toEqual([1, 10, 25]);
    expect(crossedTiers([1, 10, 25, 50], 0)).toEqual([]);
    expect(crossedTiers([1, 10, 25, 50], 100)).toEqual([1, 10, 25, 50]);
  });
});

describe("isChannelNotable", () => {
  test("respects dmOnly for guess_first", () => {
    const def = achievementById.get("guess_first")!;
    expect(isChannelNotable(def, ONESHOT_TIER)).toBe(false);
  });

  test("alwaysChannel rares are notable", () => {
    const def = achievementById.get("oneshot_win")!;
    expect(isChannelNotable(def, ONESHOT_TIER)).toBe(true);
  });

  test("medalist daily requires 15+", () => {
    const def = achievementById.get("medalist_daily")!;
    expect(isChannelNotable(def, 5)).toBe(false);
    expect(isChannelNotable(def, 15)).toBe(true);
  });

  test("medalist monthly is notable from 1", () => {
    const def = achievementById.get("medalist_monthly")!;
    expect(isChannelNotable(def, 1)).toBe(true);
  });

  test("host_games channel from 50", () => {
    const def = achievementById.get("host_games")!;
    expect(isChannelNotable(def, 25)).toBe(false);
    expect(isChannelNotable(def, 50)).toBe(true);
  });
});

describe("oneshot win predicate", () => {
  test("requires zero unique wrongs", () => {
    const requireZero = (uniqueWrongCountryCount: number) => uniqueWrongCountryCount === 0;
    expect(requireZero(0)).toBe(true);
    expect(requireZero(5)).toBe(false);
  });
});

describe("clutch uses board wrong count", () => {
  test("threshold compares game unique_wrong_country_count", () => {
    const boardWrong = 100;
    const personalWrong = 3;
    const tiers = [25, 50, 75, 100, 150];
    expect(crossedTiers(tiers, boardWrong)).toContain(100);
    expect(crossedTiers(tiers, personalWrong)).not.toContain(100);
  });
});

describe("computeStreakFromDates", () => {
  test("computes best and current Istanbul streaks", () => {
    // Three consecutive Istanbul days ending "today" relative to fixed now
    const now = new Date("2026-07-12T10:00:00.000Z"); // Jul 12 afternoon UTC = Jul 12 Istanbul
    const dates = [
      new Date("2026-07-09T21:00:00.000Z"), // Jul 10 00:00 Istanbul
      new Date("2026-07-10T21:00:00.000Z"), // Jul 11
      new Date("2026-07-11T21:00:00.000Z"), // Jul 12
    ];
    const streak = computeStreakFromDates(dates, now);
    expect(streak.best).toBe(3);
    expect(streak.current).toBe(3);
  });

  test("broken streak lowers current but keeps best", () => {
    const now = new Date("2026-07-12T10:00:00.000Z");
    const dates = [
      new Date("2026-07-07T21:00:00.000Z"), // Jul 8
      new Date("2026-07-08T21:00:00.000Z"), // Jul 9
      new Date("2026-07-11T21:00:00.000Z"), // Jul 12 only
    ];
    const streak = computeStreakFromDates(dates, now);
    expect(streak.best).toBeGreaterThanOrEqual(2);
    expect(streak.current).toBe(1);
  });
});

describe("geography", () => {
  test("territories include RE and AQ", () => {
    expect(isTerritoryCountry("RE")).toBe(true);
    expect(isTerritoryCountry("AQ")).toBe(true);
    expect(isTerritoryCountry("TR")).toBe(false);
  });

  test("continent mapping covers tour set", () => {
    expect(continentForCountry("TR")).toBe("AS");
    expect(continentForCountry("FR")).toBe("EU");
    expect(continentForCountry("BR")).toBe("SA");
    expect(continentForCountry("US")).toBe("NA");
    expect(continentForCountry("ZA")).toBe("AF");
    expect(continentForCountry("AU")).toBe("OC");
    expect(continentForCountry("AQ")).toBe("AN");
  });

  test("hasAllContinents requires every continent", () => {
    expect(hasAllContinents(["TR", "FR", "BR", "US", "ZA", "AU", "AQ"])).toBe(true);
    expect(hasAllContinents(["TR", "FR", "BR"])).toBe(false);
    expect(CONTINENTS).toHaveLength(7);
  });
});

describe("hiddenUntilEarn catalog flags", () => {
  test("rares hide conditions until earned", () => {
    expect(achievementById.get("oneshot_win")?.hiddenUntilEarn).toBe(true);
    expect(achievementById.get("host_games")?.hiddenUntilEarn).toBe(false);
  });
});

describe("achievements per game mode", () => {
  test("keeps world geography achievements out of province games", () => {
    expect(isAchievementInMode("continent_tour", "province")).toBe(false);
    expect(isAchievementInMode("territory_win", "province")).toBe(false);
    expect(isAchievementInMode("patient_zero", "province")).toBe(false);
    expect(isAchievementInMode("continent_tour", "country")).toBe(true);
    expect(catalogForMode("province").some((item) => item.id === "win_countries")).toBe(true);
  });
});
