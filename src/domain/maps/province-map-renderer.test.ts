import { describe, expect, test } from "bun:test";
import { loadImage } from "@napi-rs/canvas";
import { renderProvinceMap } from "./province-map-renderer.ts";

const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);

describe("renderProvinceMap", () => {
  test("encodes a Türkiye map as JPEG", async () => {
    const map = renderProvinceMap({
      wrongProvinces: ["06", "34", "35"],
      correctProvince: "42",
      marker: { latitude: 37.87, longitude: 32.48 },
    });

    expect(map.contentType).toBe("image/jpeg");
    expect(map.buffer.subarray(0, 3).equals(JPEG_SOI)).toBe(true);
    expect(map.buffer.byteLength).toBeLessThan(1_000_000);

    const image = await loadImage(map.buffer);
    expect(image.width).toBeGreaterThan(image.height * 1.5);
  });
});
