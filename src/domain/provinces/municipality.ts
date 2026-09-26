import type { NominatimAddress } from "../geocoding/resolve-territory-code.ts";
import { getProvinceName, normalizeProvinceName } from "./normalize-province-guess.ts";

/** The 30 provinces with a metropolitan municipality (büyükşehir belediyesi). */
export const METROPOLITAN_PROVINCE_CODES = new Set([
  "01", "06", "07", "09", "10", "16", "20", "21", "25", "26",
  "27", "31", "33", "34", "35", "38", "41", "42", "44", "45",
  "46", "47", "48", "52", "54", "55", "59", "61", "63", "65",
]); // prettier-ignore

export type ProvinceLocationDetails = {
  /** District (ilçe) name. `Merkez` for the central district of a non-metropolitan province. */
  district?: string;
  /** "Sorgun Belediyesi", or "Yozgat Belediyesi" for a central district. */
  municipality?: string;
  /** "İstanbul Büyükşehir Belediyesi" in the 30 metropolitan provinces. */
  metropolitanMunicipality?: string;
  /** Mahalle or köy. */
  neighbourhood?: string;
};

const addressOf = (raw: unknown): NominatimAddress => {
  if (raw && typeof raw === "object" && "address" in raw) {
    const address = (raw as { address?: unknown }).address;
    if (address && typeof address === "object") {
      return address as NominatimAddress;
    }
  }
  return {};
};

/** Some OSM names already carry the suffix ("Isparta Belediyesi"). */
const withoutMunicipalitySuffix = (name: string) => name.replace(/\s+belediyesi$/iu, "").trim();

const isCentralDistrictName = (name: string) => {
  const normalized = normalizeProvinceName(name);
  return normalized === "merkez" || normalized.endsWith(" merkez");
};

/**
 * District, municipality, and neighbourhood from a Nominatim reverse-geocode result.
 *
 * In Türkiye OSM tags districts (admin_level 6) so that Nominatim returns them as
 * `town` ("Çankaya", "Sorgun"). The central district of a non-metropolitan province
 * has no `town`; it shows up as `city` or `county` "Bolu Merkez", or as `city` equal
 * to the province name. Its municipality is the province municipality.
 */
export const describeProvinceLocation = (
  raw: unknown,
  provinceCode: string,
): ProvinceLocationDetails => {
  const address = addressOf(raw);
  const clean = (name: string | undefined) =>
    name === undefined ? undefined : withoutMunicipalitySuffix(name);
  const town = clean(address.town);
  const provinceName = getProvinceName(provinceCode);
  const isMetropolitan = METROPOLITAN_PROVINCE_CODES.has(provinceCode);
  const isProvinceName = (name: string) =>
    normalizeProvinceName(name) === normalizeProvinceName(provinceName);

  let district: string | undefined;
  let central = false;
  if (town && !isCentralDistrictName(town) && !isProvinceName(town)) {
    district = town;
  } else if (!isMetropolitan) {
    central = [town, clean(address.city), clean(address.county), clean(address.municipality)].some(
      (name) => name !== undefined && (isCentralDistrictName(name) || isProvinceName(name)),
    );
  }

  const neighbourhood =
    address.suburb ??
    address.village ??
    address.neighbourhood ??
    address.quarter ??
    address.residential ??
    address.hamlet;

  return {
    district: central ? "Merkez" : district,
    municipality: central
      ? `${provinceName} Belediyesi`
      : district
        ? `${district} Belediyesi`
        : undefined,
    metropolitanMunicipality: isMetropolitan ? `${provinceName} Büyükşehir Belediyesi` : undefined,
    neighbourhood,
  };
};
