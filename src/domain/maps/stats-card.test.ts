import { describe, expect, test } from "bun:test";
import { loadImage } from "@napi-rs/canvas";
import type { ServerStats } from "../../repositories/server-stats-repository.ts";
import { monthRange } from "../../repositories/server-stats-repository.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";
import { renderStatsCard, STATS_CARD_LAYOUTS, type StatsCardLayoutName } from "./stats-card.ts";

const NOW = new Date("2026-10-08T19:00:00Z");

const countryStats: ServerStats = {
  mode: "country",
  firstGameAt: new Date("2025-07-07T15:15:00Z"),
  completedGames: 699,
  totalGuesses: 10622,
  totalPlayers: 56,
  hosts: 26,
  participations: 2062,
  oneshotGames: 104,
  pointsAwarded: 94810,
  achievementsUnlocked: 412,
  hardestGameGuesses: 87,
  busiestDay: { date: "2026-08-15", games: 41 },
  // Macao and Andorra are too small to fill, so they take the dot path.
  locations: [
    { code: "TR", count: 32 },
    { code: "US", count: 20 },
    { code: "MO", count: 3 },
    { code: "AD", count: 1 },
  ],
  mostWrongGuess: { code: "RU", count: 214 },
  // Fifteen months: the chart keeps the last twelve.
  monthly: monthRange("2025-07", "2026-10").map((month, index) => ({ month, games: index * 7 })),
  hourly: Array.from({ length: 24 }, (_, hour) => hour),
  topWinner: { name: "Fenerbahçe Sevdalısı Dadashovski", count: 131 },
  topHost: { name: "Veotaar", count: 88 },
};

const emptyStats: ServerStats = {
  ...countryStats,
  mode: "province",
  firstGameAt: null,
  completedGames: 0,
  totalGuesses: 0,
  participations: 0,
  busiestDay: null,
  locations: [],
  mostWrongGuess: null,
  monthly: [],
  hourly: Array.from({ length: 24 }, () => 0),
  topWinner: null,
  topHost: null,
};

const decode = async (buffer: Buffer) => {
  expect(Array.from(buffer.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return loadImage(buffer);
};

describe("monthRange", () => {
  test("crosses the year end and includes both ends", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthRange("2026-10", "2026-10")).toEqual(["2026-10"]);
  });
});

describe("stats card", () => {
  const layouts = Object.keys(STATS_CARD_LAYOUTS) as StatsCardLayoutName[];
  test.each(layouts)(
    "%s renders both modes and an empty server at full resolution",
    async (layout) => {
      for (const stats of [
        countryStats,
        { ...countryStats, mode: "province" as const, locations: [{ code: "34", count: 5 }] },
        emptyStats,
      ]) {
        const card = renderStatsCard(stats, layout, NOW);
        const image = await decode(card.buffer);
        expect(image.width).toBe(960 * MAP_RESOLUTION_SCALE);
        expect(image.height).toBe(STATS_CARD_LAYOUTS[layout].height * MAP_RESOLUTION_SCALE);
        expect(card.filename).toBe(`stats-${stats.mode}.png`);
      }
    },
    30_000,
  );
});
