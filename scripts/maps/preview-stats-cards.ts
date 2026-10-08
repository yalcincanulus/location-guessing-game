import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { ServerStats } from "../../src/repositories/server-stats-repository.ts";
import { monthRange } from "../../src/repositories/server-stats-repository.ts";
import { renderStatsCard, STATS_CARD_LAYOUTS } from "../../src/domain/maps/stats-card.ts";

const output = resolve(process.argv[2] ?? ".cache/stats-cards");
await mkdir(output, { recursive: true });

const NOW = new Date("2026-10-08T19:00:00Z");

/** Long-tailed counts: the first few locations come up far more often than the rest. */
const tail = (codes: string[], top: number) =>
  codes.map((code, index) => ({ code, count: Math.max(1, Math.round(top / (1 + index * 0.6))) }));

const COUNTRY_CODES = (
  "TR US RU FR BR JP DE IT ES GB CA AU MX AR IN ID ZA KR NO SE FI PL UA RO GR PT NL BE CH AT " +
  "CZ HU BG RS HR TH VN PH MY KZ MN CL PE CO EC BO UY NZ IS IE DK LT LV EE SK SI AL MK ME BA " +
  "IL JO AE TN KE NG GH SN BW NA UG RW LK BD BT KH TW HK SG MO GU AD MT CY LU MQ RE"
).split(" ");
const PROVINCE_CODES =
  "34 06 35 61 07 01 16 42 55 27 21 33 10 38 26 44 65 25 09 20 48 17 52 53 08 37 28 57 63 31".split(
    " ",
  );

const monthly = (first: string, values: number[]) =>
  monthRange(first, "2026-10").map((month, index) => ({ month, games: values[index] ?? 0 }));

const hourly = [
  3, 1, 0, 0, 0, 0, 1, 2, 5, 9, 12, 14, 18, 20, 19, 22, 25, 31, 38, 44, 49, 41, 27, 11,
];

const SAMPLES: Record<string, ServerStats> = {
  country: {
    mode: "country",
    firstGameAt: new Date("2026-07-07T15:15:00Z"),
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
    locations: tail(COUNTRY_CODES, 32).slice(0, 153),
    mostWrongGuess: { code: "RU", count: 214 },
    monthly: monthly("2026-07", [96, 241, 198, 164]),
    hourly,
    topWinner: { name: "Veotaar", count: 131 },
    topHost: { name: "Fenerbahçe Sevdalısı Dadashovski", count: 88 },
  },
  province: {
    mode: "province",
    firstGameAt: new Date("2026-09-26T00:45:00Z"),
    completedGames: 118,
    totalGuesses: 1432,
    totalPlayers: 21,
    hosts: 9,
    participations: 344,
    oneshotGames: 12,
    pointsAwarded: 14820,
    achievementsUnlocked: 63,
    hardestGameGuesses: 42,
    busiestDay: { date: "2026-10-03", games: 22 },
    locations: tail(PROVINCE_CODES, 14),
    mostWrongGuess: { code: "06", count: 51 },
    monthly: monthly("2026-09", [31, 87]),
    hourly,
    topWinner: { name: "Çağrı", count: 23 },
    topHost: { name: "Veotaar", count: 31 },
  },
  empty: {
    mode: "country",
    firstGameAt: null,
    completedGames: 0,
    totalGuesses: 0,
    totalPlayers: 0,
    hosts: 0,
    participations: 0,
    oneshotGames: 0,
    pointsAwarded: 0,
    achievementsUnlocked: 0,
    hardestGameGuesses: 0,
    busiestDay: null,
    locations: [],
    mostWrongGuess: null,
    monthly: [],
    hourly: Array.from({ length: 24 }, () => 0),
    topWinner: null,
    topHost: null,
  },
};

const files = [];
for (const layout of Object.keys(STATS_CARD_LAYOUTS) as Array<keyof typeof STATS_CARD_LAYOUTS>) {
  for (const [sample, stats] of Object.entries(SAMPLES)) {
    const card = renderStatsCard(stats, layout, NOW);
    const file = resolve(output, `${layout}-${sample}.png`);
    await Bun.write(file, card.buffer);
    files.push(file);
  }
}
console.log(`Rendered ${files.length} stats cards in ${output}.`);
