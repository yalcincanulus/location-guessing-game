import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { geoMercator } from "d3-geo";
import { provinceCollection } from "../provinces/province-geometry.ts";
import { MAP_HEADER_HEIGHT } from "./map-header.ts";
import { MAP_RESOLUTION_SCALE, mapViewports } from "./region-presets.ts";
import { PLAYER_MAP_COLORS, renderPlayerMap, type PlayerMapKind } from "./player-map-renderer.ts";
import { mapThemes } from "./themes.ts";
import type { GameMode } from "../game/game-mode.ts";

const colorRgb = (color: string) =>
  [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));

describe("player map images", () => {
  test("uses gold for wins and a separate start color from every guess palette", () => {
    expect(PLAYER_MAP_COLORS.wins).toBe("#d4af37");
    expect(PLAYER_MAP_COLORS.starts).not.toBe(PLAYER_MAP_COLORS.wins);
    for (const theme of Object.values(mapThemes)) {
      expect([theme.wrong, theme.correct, theme.country, theme.ocean]).not.toContain(
        PLAYER_MAP_COLORS.starts,
      );
    }
  });

  const cases: Array<[GameMode, PlayerMapKind]> = [
    ["country", "wins"],
    ["country", "starts"],
    ["province", "wins"],
    ["province", "starts"],
  ];
  test.each(cases)(
    "%s %s paints selected locations without changing the map framing",
    async (mode, kind) => {
      const map = renderPlayerMap({
        kind,
        mode,
        playerName: "Çağrı — Map player",
        medals: { gold: 12, silver: 7, bronze: 3 },
        locationCodes: mode === "country" ? ["TR"] : ["06"],
        gameCount: 4,
        generatedAt: new Date("2026-10-07T22:20:00Z"),
      });
      const image = await loadImage(map.buffer);
      const height = mode === "country" ? mapViewports.world!.height : 720 * MAP_RESOLUTION_SCALE;
      expect(image.height).toBe(height + MAP_HEADER_HEIGHT);
      expect(image.width).toBe(1400 * MAP_RESOLUTION_SCALE);
      expect(map.filename).toBe(`${mode}-${kind}-map-2026-10-08.png`);
      expect(map.contentType).toBe("image/png");
      expect(map.buffer.byteLength).toBeLessThan(8 * 1024 * 1024);

      const canvas = createCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const ui = MAP_RESOLUTION_SCALE;
      const preset = mapViewports.world!;
      const projection =
        mode === "country"
          ? geoMercator()
              .scale(preset.scale)
              .rotate([-preset.center[0], 0])
              .center([0, preset.center[1]])
              .translate(preset.translate)
          : geoMercator().fitExtent(
              [
                [28 * ui, 28 * ui],
                [image.width - 28 * ui, height - 28 * ui],
              ],
              provinceCollection as never,
            );
      const [x, y] = projection([32.8, 39.9])!;
      const pixel = context.getImageData(
        Math.round(x),
        Math.round(y) + MAP_HEADER_HEIGHT,
        1,
        1,
      ).data;
      expect(Array.from(pixel.slice(0, 3))).toEqual(colorRgb(PLAYER_MAP_COLORS[kind]));

      // Text occupies the header, while the neutral sea under it keeps its original color.
      const { data } = context.getImageData(24 * ui, 12 * ui, image.width - 48 * ui, 126 * ui);
      let textPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 100 && data[i + 1]! > 100 && data[i + 2]! > 100) textPixels++;
      }
      expect(textPixels).toBeGreaterThan(1000);
    },
  );

  test("renders an empty history and a long player name", async () => {
    const map = renderPlayerMap({
      kind: "wins",
      mode: "province",
      playerName: "Şanlıurfa ".repeat(100),
      medals: { gold: 0, silver: 0, bronze: 0 },
      locationCodes: [],
      gameCount: 0,
    });
    const image = await loadImage(map.buffer);
    expect(image.height).toBe(720 * MAP_RESOLUTION_SCALE + MAP_HEADER_HEIGHT);
  });
});
