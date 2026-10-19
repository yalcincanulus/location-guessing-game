import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { renderMap } from "../../src/domain/maps/map-renderer.ts";
import { renderPlayerMap } from "../../src/domain/maps/player-map-renderer.ts";
import { renderProvinceMap } from "../../src/domain/maps/province-map-renderer.ts";
import { MAP_THEMES, MAP_THEME_NAMES, type MapThemeName } from "../../src/domain/maps/themes.ts";

// Usage: [output directory] [theme…]
const [directory, ...requested] = process.argv.slice(2);
const output = resolve(directory ?? ".cache/map-themes");
await mkdir(output, { recursive: true });
const themes = requested.length
  ? MAP_THEME_NAMES.filter((name) => requested.includes(name))
  : MAP_THEME_NAMES;

/** The maps a game shows, rendered for one theme. */
const samples = (theme: MapThemeName) => ({
  // `!map` partway through a game.
  world: renderMap({ wrongCountries: ["FR", "DE", "BR", "RU", "IN", "AU", "LU", "CY"], theme }),
  europe: renderMap({ wrongCountries: ["FR", "DE", "PL", "IT", "SI"], viewport: "europe", theme }),
  // The map posted when someone finds the answer.
  found: renderMap({
    wrongCountries: ["GR", "BG", "SY", "IR", "CY"],
    correctCountry: "TR",
    marker: { latitude: 39.92, longitude: 32.85 },
    theme,
  }),
  province: renderProvinceMap({
    wrongProvinces: ["34", "35", "07", "16", "42", "61"],
    correctProvince: "06",
    marker: { latitude: 39.92, longitude: 32.85 },
    theme,
  }),
  winmap: renderPlayerMap({
    kind: "wins",
    mode: "country",
    headerDesign: "plain",
    playerName: "Çağrı",
    medals: { gold: 3, silver: 2, bronze: 1 },
    locationCodes: ["TR", "FR", "GB", "BR", "US", "JP", "AU", "ZA", "DE", "IN"],
    gameCount: 42,
    generatedAt: new Date("2026-10-19T12:00:00+03:00"),
    theme,
  }),
});

const SHEET_COLUMNS = ["found", "world", "province"] as const;
const THUMB_WIDTH = 640;
const LABEL_HEIGHT = 56;
const rows: Array<{ theme: MapThemeName; images: Awaited<ReturnType<typeof loadImage>>[] }> = [];

for (const theme of themes) {
  const maps = samples(theme);
  for (const [name, map] of Object.entries(maps)) {
    await Bun.write(resolve(output, `${theme}-${name}.png`), map.buffer);
  }
  rows.push({
    theme,
    images: await Promise.all(SHEET_COLUMNS.map((column) => loadImage(maps[column].buffer))),
  });
}

// One overview image: a row per theme, so themes can be compared side by side.
const rowHeight =
  LABEL_HEIGHT +
  Math.max(
    ...rows.flatMap((row) => row.images.map((image) => (image.height / image.width) * THUMB_WIDTH)),
  );
const gap = 16;
const sheet = createCanvas(
  SHEET_COLUMNS.length * (THUMB_WIDTH + gap) + gap,
  rows.length * (rowHeight + gap) + gap,
);
const context = sheet.getContext("2d");
context.fillStyle = "#111111";
context.fillRect(0, 0, sheet.width, sheet.height);
rows.forEach(({ theme, images }, rowIndex) => {
  const y = gap + rowIndex * (rowHeight + gap);
  const { names, descriptions } = MAP_THEMES[theme];
  const title = `${names.tr} (${theme})`;
  context.fillStyle = "#f5f5f5";
  context.font = 'bold 26px "DejaVu Sans", Arial, sans-serif';
  context.fillText(title, gap, y + 30);
  const titleWidth = context.measureText(title).width;
  context.fillStyle = "#a3a3a3";
  context.font = '18px "DejaVu Sans", Arial, sans-serif';
  context.fillText(descriptions.tr, gap + titleWidth + 16, y + 30);
  images.forEach((image, column) => {
    const height = (image.height / image.width) * THUMB_WIDTH;
    context.drawImage(
      image,
      gap + column * (THUMB_WIDTH + gap),
      y + LABEL_HEIGHT,
      THUMB_WIDTH,
      height,
    );
  });
});
await Bun.write(resolve(output, "overview.png"), sheet.toBuffer("image/png"));
console.log(`Rendered ${themes.length} themes and an overview in ${output}.`);
