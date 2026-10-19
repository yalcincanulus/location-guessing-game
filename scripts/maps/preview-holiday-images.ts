import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { imageOccasionOn } from "../../src/domain/holidays/national-holidays.ts";
import { renderMap } from "../../src/domain/maps/map-renderer.ts";
import { renderPlayerMap } from "../../src/domain/maps/player-map-renderer.ts";
import {
  PROFILE_CARD_LAYOUTS,
  renderProfileCard,
  type ProfileCardLayout,
} from "../../src/domain/maps/profile-card.ts";
import { renderProvinceMap } from "../../src/domain/maps/province-map-renderer.ts";
import { renderStatsCard, STATS_CARD_LAYOUTS } from "../../src/domain/maps/stats-card.ts";
import { SAMPLES } from "./stats-card-samples.ts";

// Usage: [output directory] [--only <day>]
const only = process.argv.indexOf("--only");
const selected = only === -1 ? undefined : process.argv[only + 1];
const directory = process.argv
  .slice(2)
  .find((arg, index) => !arg.startsWith("--") && process.argv[index + 1] !== "--only");
const output = resolve(directory ?? ".cache/holiday-images");
await mkdir(output, { recursive: true });

/** Midday in Istanbul on each day that changes the images. */
const OCCASION_DATES = {
  childrensDay: new Date("2027-04-23T12:00:00+03:00"),
  youthDay: new Date("2027-05-19T12:00:00+03:00"),
  victoryDay: new Date("2027-08-30T12:00:00+03:00"),
  republicDay: new Date("2026-10-29T12:00:00+03:00"),
  ataturkMemorialDay: new Date("2026-11-10T12:00:00+03:00"),
};

const files: string[] = [];
const write = async (name: string, buffer: Buffer) => {
  const file = resolve(output, `${name}.png`);
  await Bun.write(file, buffer);
  files.push(file);
};

for (const [day, date] of Object.entries(OCCASION_DATES)) {
  if (selected && day !== selected) continue;
  const occasion = imageOccasionOn(date);
  // `!map` during a game, and the map posted when someone finds the country.
  await write(
    `${day}-map-world`,
    renderMap({ wrongCountries: ["FR", "DE", "BR", "RU", "IN"], ...occasion }).buffer,
  );
  await write(
    `${day}-map-europe`,
    renderMap({ wrongCountries: ["FR", "DE", "PL"], viewport: "europe", ...occasion }).buffer,
  );
  await write(
    `${day}-map-found`,
    renderMap({
      wrongCountries: ["GR", "BG"],
      correctCountry: "TR",
      marker: { latitude: 39.92, longitude: 32.85 },
      ...occasion,
    }).buffer,
  );
  await write(
    `${day}-map-province`,
    renderProvinceMap({
      wrongProvinces: ["34", "35", "07"],
      correctProvince: "06",
      marker: { latitude: 39.92, longitude: 32.85 },
      ...occasion,
    }).buffer,
  );

  for (const [mode, design, medals] of [
    ["country", "plain", { gold: 3, silver: 2, bronze: 1 }],
    ["country", "atlasGlobe", { gold: 143, silver: 90, bronze: 40 }],
    ["province", "passport", { gold: 52, silver: 31, bronze: 18 }],
  ] as const) {
    await write(
      `${day}-winmap-${mode}-${design}`,
      renderPlayerMap({
        kind: "wins",
        mode,
        headerDesign: design,
        playerName: "Çağrı",
        medals,
        locationCodes:
          mode === "country"
            ? ["TR", "FR", "GB", "BR", "US", "JP", "AU", "ZA", "DE", "IN"]
            : ["06", "34", "35", "42", "07", "61"],
        gameCount: 42,
        generatedAt: date,
      }).buffer,
    );
  }

  for (const layout of Object.keys(PROFILE_CARD_LAYOUTS) as ProfileCardLayout[]) {
    for (const [tier, medals] of [
      ["plain", { gold: 0, silver: 0, bronze: 4 }],
      ["legend", { gold: 116, silver: 105, bronze: 142 }],
    ] as const) {
      await write(
        `${day}-profile-${layout}-${tier}`,
        renderProfileCard(
          {
            mode: "country",
            playerName: "Fenerbahçe Sevdalısı",
            points: 2947,
            wins: 323,
            participated: 718,
            gamesStarted: 180,
            guesses: 4308,
            gmMultiplier: 1.25,
            medals,
            achievementsUnlocked: 23,
            periodWins: { daily: 81, weekly: 21, monthly: 9, seasonal: 3, yearly: 1 },
            goldPeriods: [
              { periodType: "yearly", periodKey: "2025" },
              { periodType: "seasonal", periodKey: "2026-summer" },
              { periodType: "monthly", periodKey: "2026-09" },
            ],
            stamps: [
              { code: "TR", name: "TÜRKİYE", count: 41, coordinates: [35, 39] },
              { code: "FR", name: "FRANSA", count: 27, coordinates: [2.3, 46.6] },
              { code: "JP", name: "JAPONYA", count: 19, coordinates: [138, 36] },
            ],
            ...occasion,
          },
          layout,
        ).buffer,
      );
    }
  }

  for (const layout of Object.keys(STATS_CARD_LAYOUTS) as Array<keyof typeof STATS_CARD_LAYOUTS>) {
    for (const mode of ["country", "province"] as const) {
      await write(
        `${day}-stats-${layout}-${mode}`,
        renderStatsCard(SAMPLES[mode]!, layout, date).buffer,
      );
    }
  }
}
console.log(`Rendered ${files.length} images in ${output}.`);
