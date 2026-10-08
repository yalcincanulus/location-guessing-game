import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { PassportStamp } from "../../src/domain/maps/player-map-header-designs.ts";
import { PLAYER_NAME_TIER_THRESHOLDS } from "../../src/domain/maps/player-name-style.ts";
import { renderProfileCard } from "../../src/domain/maps/profile-card.ts";

const output = resolve(process.argv[2] ?? ".cache/profile-cards");
await mkdir(output, { recursive: true });

const STAMPS: Record<"country" | "province", PassportStamp[]> = {
  country: [
    { code: "TR", name: "TÜRKİYE", count: 41, coordinates: [35, 39] },
    { code: "FR", name: "FRANSA", count: 27, coordinates: [2.3, 46.6] },
    { code: "JP", name: "JAPONYA", count: 19, coordinates: [138, 36] },
    { code: "BR", name: "BREZİLYA", count: 12, coordinates: [-51, -10] },
  ],
  province: [
    { code: "34", name: "İSTANBUL", count: 23, coordinates: [28.97, 41.01] },
    { code: "06", name: "ANKARA", count: 17, coordinates: [32.85, 39.93] },
    { code: "35", name: "İZMİR", count: 11, coordinates: [27.14, 38.42] },
    { code: "61", name: "TRABZON", count: 6, coordinates: [39.72, 41] },
  ],
};

/** Medals worth exactly `points`, split roughly half gold, a third silver, the rest bronze. */
const medalsFor = (points: number) => {
  const gold = Math.floor((points * 0.5) / 3);
  const silver = Math.floor((points * 0.3) / 2);
  return { gold, silver, bronze: points - gold * 3 - silver * 2 };
};

/** Sample card stats for the tier at `index`, plus the medal points they are worth. */
const sampleCard = (mode: "country" | "province", index: number, playerName: string) => {
  const [, minimum] = PLAYER_NAME_TIER_THRESHOLDS[index]!;
  // 40% of the way into the tier; the top tier has no ceiling, so go a little past its floor.
  const next = PLAYER_NAME_TIER_THRESHOLDS[index + 1]?.[1];
  const points = Math.round(next ? minimum + (next - minimum) * 0.4 : minimum * 1.16) || 4;
  // Games grow with tier so the top tiers show four-digit stats.
  const participated = 18 + points;
  const wins = Math.round(participated * 0.45);
  const medals = medalsFor(points);
  // Daily golds are by far the most common; yearly ones the rarest.
  const periodWins = {
    daily: Math.round(medals.gold * 0.7),
    weekly: Math.round(medals.gold * 0.18),
    monthly: Math.round(medals.gold * 0.08),
    seasonal: Math.round(medals.gold * 0.03),
    yearly: Math.round(medals.gold * 0.01),
  };
  // One named period per gold, counting back from autumn 2026.
  const seasons = ["summer", "spring", "winter", "fall"];
  const goldPeriods = [
    ...Array.from({ length: periodWins.monthly }, (_, back) => {
      const month = new Date(Date.UTC(2026, 8 - back, 1));
      const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
      return { periodType: "monthly" as const, periodKey: key };
    }),
    ...Array.from({ length: periodWins.seasonal }, (_, back) => ({
      periodType: "seasonal" as const,
      periodKey: `${2026 - Math.floor((back + 2) / 4)}-${seasons[back % 4]}`,
    })),
    ...Array.from({ length: periodWins.yearly }, (_, back) => ({
      periodType: "yearly" as const,
      periodKey: String(2025 - back),
    })),
  ];
  const card = renderProfileCard({
    mode,
    playerName,
    points: wins * 9 + 40,
    wins,
    participated,
    gamesStarted: Math.round(participated / 4),
    guesses: participated * 6,
    gmMultiplier: 1.25,
    medals,
    achievementsUnlocked: 3 + index * 4,
    periodWins,
    goldPeriods,
    stamps: STAMPS[mode],
  });
  return { card, points };
};

const files = [];
for (const mode of ["country", "province"] as const) {
  for (const [index, [tier]] of PLAYER_NAME_TIER_THRESHOLDS.entries()) {
    const { card, points } = sampleCard(mode, index, "Çağrı");
    const file = resolve(output, `${mode}-${index + 1}-${tier}.png`);
    await Bun.write(file, card.buffer);
    files.push({ mode, tier, points, file, bytes: card.buffer.byteLength });
  }
}

// Long names (Discord allows 32 characters) on the plainest, a middle and the most decorated tier.
const LONG_NAMES = [
  "Fenerbahçe Sevdalısı",
  "Kuzey Yıldızı Kartografyacı",
  "Fenerbahçe Sevdalısı Dadashovski",
];
const lastTier = PLAYER_NAME_TIER_THRESHOLDS.length - 1;
for (const index of [0, Math.floor(lastTier / 2), lastTier]) {
  const [tier] = PLAYER_NAME_TIER_THRESHOLDS[index]!;
  for (const [nameIndex, name] of LONG_NAMES.entries()) {
    const { card, points } = sampleCard("country", index, name);
    const file = resolve(output, `long-name-${nameIndex + 1}-${index + 1}-${tier}.png`);
    await Bun.write(file, card.buffer);
    files.push({ mode: "country", tier, points, file, bytes: card.buffer.byteLength });
  }
}
await Bun.write(resolve(output, "manifest.json"), `${JSON.stringify(files, null, 2)}\n`);
console.log(`Rendered ${files.length} profile cards in ${output}.`);
