import { describe, expect, test } from "bun:test";
import { resolveProvince } from "./resolve-province.ts";

describe("resolveProvince", () => {
  test("uses the ISO 3166-2 code from Nominatim", () => {
    const raw = {
      address: { province: "Istanbul", "ISO3166-2-lvl4": "TR-34", country_code: "tr" },
    };
    expect(resolveProvince(raw, 40.99, 29.03)).toEqual({ provinceCode: "34", source: "iso" });
  });

  test("falls back to the province name", () => {
    const raw = { address: { province: "Şanlıurfa", country_code: "tr" } };
    expect(resolveProvince(raw, 37.16, 38.79)).toEqual({ provinceCode: "63", source: "name" });
  });

  test("falls back to the province shapes", () => {
    expect(resolveProvince({ address: {} }, 39.93, 32.85)).toEqual({
      provinceCode: "06",
      source: "geometry",
    });
  });

  test("returns undefined outside Türkiye", () => {
    expect(resolveProvince({ address: {} }, 48.85, 2.35)).toBeUndefined();
  });
});
