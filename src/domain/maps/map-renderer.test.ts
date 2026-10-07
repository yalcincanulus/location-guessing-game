import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderMap } from "./map-renderer.ts";
import { MAP_RESOLUTION_SCALE, mapViewports } from "./region-presets.ts";
import { geoMercator } from "d3-geo";
import { activeMapTheme } from "./themes.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const hasColorInStrip = (
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  color: string,
) => {
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (rgb.every((channel, offset) => data[i + offset] === channel)) {
        return true;
      }
    }
  }
  return false;
};

describe("renderMap", () => {
  test("encodes a world map as lossless PNG at the configured canvas size", async () => {
    const map = renderMap({
      wrongCountries: ["FR", "DE", "IT", "ES", "TR", "BR", "JP", "AU"],
      correctCountry: "US",
      viewport: "world",
    });

    expect(map.contentType).toBe("image/png");
    expect(map.filename).toBe("world-guesses.png");
    expect(map.buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(map.buffer.byteLength).toBeLessThan(8 * 1024 * 1024);

    const image = await loadImage(map.buffer);
    expect(image.width).toBe(mapViewports.world!.width);
    expect(image.height).toBe(mapViewports.world!.height);

    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const preset = mapViewports.world!;
    const projection = geoMercator()
      .scale(preset.scale)
      .rotate([-preset.center[0], 0])
      .center([0, preset.center[1]])
      .translate(preset.translate);
    for (const [coordinates, color] of [
      [[32.8, 39.9], activeMapTheme.wrong],
      [[-98, 38], activeMapTheme.correct],
    ] as const) {
      const [x, y] = projection([...coordinates])!;
      const pixel = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
      expect(Array.from(pixel.slice(0, 3))).toEqual(rgb);
    }
  });

  test("places mainland Alaska at the left edge without repeating it on the right", async () => {
    const map = renderMap({ wrongCountries: [], correctCountry: "US", viewport: "world" });
    const image = await loadImage(map.buffer);
    const sample = createCanvas(image.width, image.height);
    const ctx = sample.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const preset = mapViewports.world!;
    const projection = geoMercator().scale(preset.scale).translate(preset.translate);
    const ui = MAP_RESOLUTION_SCALE;
    const [westernAlaskaX] = projection([-168.1, 65.6])!;
    expect(westernAlaskaX).toBeGreaterThanOrEqual(0);
    expect(westernAlaskaX).toBeLessThan(12 * ui);
    const y0 = Math.ceil(projection([0, 72])![1]);
    const y1 = Math.floor(projection([0, 60])![1]);

    expect(hasColorInStrip(data, image.width, 0, 24 * ui, y0, y1, activeMapTheme.correct)).toBe(
      true,
    );
    expect(
      hasColorInStrip(
        data,
        image.width,
        image.width - 24 * ui,
        image.width,
        y0,
        y1,
        activeMapTheme.correct,
      ),
    ).toBe(false);
  });

  test("shows the Antarctic Peninsula below South America and crops the main continent", async () => {
    const map = renderMap({ wrongCountries: ["AQ"], viewport: "world" });
    const image = await loadImage(map.buffer);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    const ui = MAP_RESOLUTION_SCALE;
    const bottom = image.height - 60 * ui;
    // The legend is at the far left; these bands sample the actual Antarctic geography.
    expect(
      hasColorInStrip(
        data,
        image.width,
        image.width * 0.25,
        image.width * 0.4,
        bottom,
        image.height,
        activeMapTheme.wrong,
      ),
    ).toBe(true);
    expect(
      hasColorInStrip(
        data,
        image.width,
        image.width * 0.4,
        image.width,
        bottom,
        image.height,
        activeMapTheme.wrong,
      ),
    ).toBe(false);
  });
});
