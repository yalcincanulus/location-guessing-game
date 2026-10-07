import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MAP_HEADER_HEIGHT } from "../../src/domain/maps/map-header.ts";
import {
  PLAYER_MAP_HEADER_DESIGNS,
  type PlayerMapHeaderDesign,
} from "../../src/domain/maps/player-map-header-designs.ts";
import { renderPlayerMap } from "../../src/domain/maps/player-map-renderer.ts";

const output = resolve(process.argv[2] ?? ".cache/player-map-headers");
await mkdir(output, { recursive: true });
const designs = Object.keys(PLAYER_MAP_HEADER_DESIGNS) as PlayerMapHeaderDesign[];
const files = [];
for (const mode of ["country", "province"] as const) {
  for (const kind of ["wins", "starts"] as const) {
    for (const design of designs) {
      const map = renderPlayerMap({
        kind,
        mode,
        headerDesign: design,
        playerName: "Çağrı",
        // Each design renders at the lowest tier that unlocks it.
        medals:
          PLAYER_MAP_HEADER_DESIGNS[design].tier === "legend"
            ? { gold: 143, silver: 90, bronze: 40 }
            : { gold: 52, silver: 31, bronze: 18 },
        locationCodes:
          mode === "country"
            ? ["TR", "FR", "GB", "BR", "US", "JP", "AU", "ZA", "DE", "IN", "CA", "MX"]
            : ["06", "34", "35", "42", "07", "61", "63", "65"],
        gameCount: mode === "country" ? 42 : 31,
        generatedAt: new Date("2026-10-07T10:20:00Z"),
      });
      const base = resolve(output, `${mode}-${kind}-${design}`);
      await Bun.write(`${base}.png`, map.buffer);
      const image = await loadImage(map.buffer);
      const header = createCanvas(image.width, MAP_HEADER_HEIGHT);
      header.getContext("2d").drawImage(image, 0, 0);
      await Bun.write(`${base}-header.png`, header.toBuffer("image/png"));
      files.push({
        mode,
        kind,
        design,
        name: PLAYER_MAP_HEADER_DESIGNS[design].name,
        map: `${base}.png`,
        header: `${base}-header.png`,
        bytes: map.buffer.byteLength,
      });
    }
  }
}
await Bun.write(resolve(output, "manifest.json"), `${JSON.stringify(files, null, 2)}\n`);
console.log(`Rendered ${files.length} maps and headers in ${output}.`);
