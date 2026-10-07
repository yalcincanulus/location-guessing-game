import { describe, expect, test } from "bun:test";
import { loadImage } from "@napi-rs/canvas";
import { renderProvinceMap } from "./province-map-renderer.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("renderProvinceMap", () => {
  test("encodes a Türkiye map as lossless PNG", async () => {
    const map = renderProvinceMap({
      wrongProvinces: ["06", "34", "35"],
      correctProvince: "42",
      marker: { latitude: 37.87, longitude: 32.48 },
    });

    expect(map.contentType).toBe("image/png");
    expect(map.buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(map.filename).toEndWith(".png");
    expect(map.buffer.byteLength).toBeLessThan(8 * 1024 * 1024);

    const image = await loadImage(map.buffer);
    expect(image.width).toBe(1400 * MAP_RESOLUTION_SCALE);
    expect(image.height).toBe(720 * MAP_RESOLUTION_SCALE);
  });
});
