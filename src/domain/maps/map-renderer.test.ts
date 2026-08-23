import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderMap } from "./map-renderer.ts";
import { mapViewports } from "./region-presets.ts";

const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);

const hasNonOceanInStrip = (
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) => {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (data[i]! + data[i + 1]! + data[i + 2]! > 40) {
        return true;
      }
    }
  }
  return false;
};

describe("renderMap", () => {
  test("encodes a world map as JPEG at the configured canvas size", async () => {
    const map = renderMap({
      wrongCountries: ["FR", "DE", "IT", "ES", "TR", "BR", "JP", "AU"],
      correctCountry: "US",
      viewport: "world",
    });

    expect(map.contentType).toBe("image/jpeg");
    expect(map.filename).toBe("world-guesses.jpg");
    expect(map.buffer.subarray(0, 3).equals(JPEG_SOI)).toBe(true);
    expect(map.buffer.byteLength).toBeLessThan(500_000);

    const image = await loadImage(map.buffer);
    expect(image.width).toBe(mapViewports.world!.width);
    expect(image.height).toBe(mapViewports.world!.height);
  });

  test("keeps wrap tiles so Alaska is visible on both edges", async () => {
    const map = renderMap({ wrongCountries: [], correctCountry: "US", viewport: "world" });
    const image = await loadImage(map.buffer);
    const sample = createCanvas(image.width, image.height);
    const ctx = sample.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const y0 = Math.floor(image.height * 0.25);
    const y1 = Math.floor(image.height * 0.5);

    expect(hasNonOceanInStrip(data, image.width, 0, 24, y0, y1)).toBe(true);
    expect(hasNonOceanInStrip(data, image.width, image.width - 24, image.width, y0, y1)).toBe(true);
  });
});
