import { describe, expect, test } from "bun:test";
import {
  assignMedals,
  getCurrentPeriodWindow,
  getIstanbulParts,
  getPreviousPeriodWindow,
  istanbulMidnight,
  periodsToFinalize,
  seasonKeyForDate,
} from "./periods.ts";

describe("istanbulMidnight", () => {
  test("maps Istanbul midnight to UTC-3 offset", () => {
    const date = istanbulMidnight(2026, 7, 11);
    expect(date.toISOString()).toBe("2026-07-10T21:00:00.000Z");
  });
});

describe("getIstanbulParts", () => {
  test("reads calendar parts in Europe/Istanbul", () => {
    // 2026-07-10 21:00 UTC = 2026-07-11 00:00 Istanbul (Saturday)
    const parts = getIstanbulParts(new Date("2026-07-10T21:00:00.000Z"));
    expect(parts).toEqual({ year: 2026, month: 7, day: 11, weekday: 6 });
  });
});

describe("getPreviousPeriodWindow", () => {
  test("daily is previous Istanbul calendar day", () => {
    const window = getPreviousPeriodWindow("daily", new Date("2026-07-10T21:00:00.000Z"));
    expect(window.periodKey).toBe("2026-07-10");
    expect(window.startsAt.toISOString()).toBe("2026-07-09T21:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-07-10T21:00:00.000Z");
  });

  test("weekly is previous Mon–Mon week on Monday midnight", () => {
    // Monday 2026-07-13 00:00 Istanbul
    const window = getPreviousPeriodWindow("weekly", new Date("2026-07-12T21:00:00.000Z"));
    expect(window.periodKey).toBe("2026-W28");
    expect(window.startsAt.toISOString()).toBe("2026-07-05T21:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-07-12T21:00:00.000Z");
  });

  test("monthly is previous calendar month on day 1", () => {
    const window = getPreviousPeriodWindow("monthly", new Date("2026-07-31T21:00:00.000Z"));
    expect(window.periodKey).toBe("2026-07");
    expect(window.startsAt.toISOString()).toBe("2026-06-30T21:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-07-31T21:00:00.000Z");
  });

  test("seasonal winter closes on March 1", () => {
    const window = getPreviousPeriodWindow("seasonal", new Date("2026-02-28T21:00:00.000Z"));
    expect(window.periodKey).toBe("2025-winter");
    expect(window.startsAt.toISOString()).toBe("2025-11-30T21:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-02-28T21:00:00.000Z");
  });

  test("yearly is previous calendar year on Jan 1", () => {
    const window = getPreviousPeriodWindow("yearly", new Date("2025-12-31T21:00:00.000Z"));
    expect(window.periodKey).toBe("2025");
    expect(window.startsAt.toISOString()).toBe("2024-12-31T21:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2025-12-31T21:00:00.000Z");
  });
});

describe("getCurrentPeriodWindow", () => {
  test("daily starts at today's Istanbul midnight", () => {
    const window = getCurrentPeriodWindow("daily", new Date("2026-07-11T10:00:00.000Z"));
    expect(window.periodKey).toBe("2026-07-11");
    expect(window.startsAt.toISOString()).toBe("2026-07-10T21:00:00.000Z");
  });

  test("seasonal current winter in January", () => {
    const window = getCurrentPeriodWindow("seasonal", new Date("2026-01-15T12:00:00.000Z"));
    expect(window.periodKey).toBe("2025-winter");
    expect(window.startsAt.toISOString()).toBe("2025-11-30T21:00:00.000Z");
  });
});

describe("periodsToFinalize", () => {
  test("every midnight finalizes daily", () => {
    expect(periodsToFinalize(new Date("2026-07-10T21:00:00.000Z"))).toEqual(["daily"]);
  });

  test("Monday midnight also finalizes weekly", () => {
    expect(periodsToFinalize(new Date("2026-07-12T21:00:00.000Z"))).toEqual(["daily", "weekly"]);
  });

  test("month start finalizes monthly", () => {
    expect(periodsToFinalize(new Date("2026-07-31T21:00:00.000Z"))).toEqual(["daily", "monthly"]);
  });

  test("March 1 finalizes monthly + seasonal", () => {
    expect(periodsToFinalize(new Date("2026-02-28T21:00:00.000Z"))).toEqual([
      "daily",
      "monthly",
      "seasonal",
    ]);
  });

  test("January 1 finalizes monthly + yearly (winter still in progress)", () => {
    // 2026-01-01 00:00 Istanbul is a Thursday
    expect(periodsToFinalize(new Date("2025-12-31T21:00:00.000Z"))).toEqual([
      "daily",
      "monthly",
      "yearly",
    ]);
  });

  test("December 1 finalizes monthly + seasonal (fall)", () => {
    // 2026-12-01 00:00 Istanbul is a Tuesday
    expect(periodsToFinalize(new Date("2026-11-30T21:00:00.000Z"))).toEqual([
      "daily",
      "monthly",
      "seasonal",
    ]);
  });
});

describe("seasonKeyForDate", () => {
  test("winter spans years", () => {
    expect(seasonKeyForDate(2025, 12)).toBe("2025-winter");
    expect(seasonKeyForDate(2026, 1)).toBe("2025-winter");
    expect(seasonKeyForDate(2026, 2)).toBe("2025-winter");
  });
});

describe("assignMedals", () => {
  test("assigns dense-rank medals with ties", () => {
    const awards = assignMedals([
      { playerId: "a", displayName: "A", discordUserId: "1", value: 100 },
      { playerId: "b", displayName: "B", discordUserId: "2", value: 100 },
      { playerId: "c", displayName: "C", discordUserId: "3", value: 90 },
      { playerId: "d", displayName: "D", discordUserId: "4", value: 80 },
      { playerId: "e", displayName: "E", discordUserId: "5", value: 70 },
    ]);

    expect(awards.map((row) => [row.playerId, row.medal, row.medalPoints])).toEqual([
      ["a", "gold", 3],
      ["b", "gold", 3],
      ["c", "silver", 2],
      ["d", "bronze", 1],
    ]);
  });

  test("stops after three tiers", () => {
    const awards = assignMedals([
      { playerId: "a", displayName: "A", discordUserId: "1", value: 3 },
      { playerId: "b", displayName: "B", discordUserId: "2", value: 2 },
      { playerId: "c", displayName: "C", discordUserId: "3", value: 1 },
    ]);
    expect(awards).toHaveLength(3);
    expect(awards[2]?.medal).toBe("bronze");
  });
});
