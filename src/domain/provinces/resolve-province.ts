import type { NominatimAddress } from "../geocoding/resolve-territory-code.ts";
import { findProvinceByName, isKnownProvinceCode } from "./normalize-province-guess.ts";
import { findProvinceAtPoint } from "./province-geometry.ts";

export type ProvinceResolution = {
  provinceCode: string;
  source: "iso" | "name" | "geometry";
};

const addressOf = (raw: unknown): NominatimAddress | undefined => {
  if (!raw || typeof raw !== "object" || !("address" in raw)) {
    return undefined;
  }
  const address = (raw as { address?: unknown }).address;
  return address && typeof address === "object" ? (address as NominatimAddress) : undefined;
};

/**
 * Finds the province for a Nominatim reverse-geocode result inside Türkiye.
 * Order: ISO 3166-2 code (`TR-34`), then the province name, then point-in-polygon.
 */
export const resolveProvince = (
  raw: unknown,
  latitude: number,
  longitude: number,
): ProvinceResolution | undefined => {
  const address = addressOf(raw);

  if (address) {
    for (const [key, value] of Object.entries(address)) {
      if (!key.startsWith("ISO3166-2-") || !value) {
        continue;
      }
      const match = /^TR-(\d{2})$/i.exec(value.trim());
      if (match?.[1] && isKnownProvinceCode(match[1])) {
        return { provinceCode: match[1], source: "iso" };
      }
    }

    for (const name of [address.province, address.state, address.city]) {
      if (!name) {
        continue;
      }
      const found = findProvinceByName(name.replace(/\s+(ili|province)$/i, ""));
      if (found) {
        return { provinceCode: found.provinceCode, source: "name" };
      }
    }
  }

  const byPoint = findProvinceAtPoint(latitude, longitude);
  return byPoint ? { provinceCode: byPoint, source: "geometry" } : undefined;
};
