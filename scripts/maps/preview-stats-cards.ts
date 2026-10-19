import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { renderStatsCard, STATS_CARD_LAYOUTS } from "../../src/domain/maps/stats-card.ts";
import { SAMPLES } from "./stats-card-samples.ts";

const output = resolve(process.argv[2] ?? ".cache/stats-cards");
await mkdir(output, { recursive: true });

const NOW = new Date("2026-10-08T19:00:00Z");

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
