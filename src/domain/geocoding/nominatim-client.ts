import { env } from "../../config/env.ts";
import { getCountryDisplayName } from "../countries/normalize-country-guess.ts";
import {
  isAntarcticLatitude,
  resolveTerritoryCountryCode,
  type NominatimAddress,
} from "./resolve-territory-code.ts";

export type ReverseGeocodeResult = {
  countryCode: string;
  countryName?: string;
  regionName?: string;
  regionCode?: string;
  placeId?: string;
  osmType?: string;
  osmId?: string;
  raw: unknown;
};

type NominatimJson = {
  error?: string;
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  address?: NominatimAddress;
};

const antarcticaFallback = (
  latitude: number,
  longitude: number,
  raw: unknown,
): ReverseGeocodeResult => ({
  countryCode: "AQ",
  countryName: getCountryDisplayName("AQ") ?? "Antarctica",
  regionName: undefined,
  regionCode: undefined,
  placeId: undefined,
  osmType: undefined,
  osmId: undefined,
  raw:
    raw ??
    ({
      fallback: "antarctica-latitude",
      latitude,
      longitude,
    } as const),
});

/**
 * A DM start geocodes once to check for Türkiye and again when the game starts.
 * Keep recent answers so the second call does not hit Nominatim.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; value: ReverseGeocodeResult }>();

/** Country games use English names. Province games use Turkish names ("Çankaya", "Bolu Merkez"). */
export type GeocodeLanguage = "en" | "tr";

const cacheKey = (latitude: number, longitude: number, language: GeocodeLanguage) =>
  `${language}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
  language: GeocodeLanguage = "en",
): Promise<ReverseGeocodeResult> => {
  const key = cacheKey(latitude, longitude, language);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await fetchReverseGeocode(latitude, longitude, language);
  cache.delete(key);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
  return value;
};

const fetchReverseGeocode = async (
  latitude: number,
  longitude: number,
  language: GeocodeLanguage,
): Promise<ReverseGeocodeResult> => {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("layer", "address");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  if (env.nominatimEmail) {
    url.searchParams.set("email", env.nominatimEmail);
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": env.nominatimUserAgent,
      "Accept-Language": language,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    if (isAntarcticLatitude(latitude)) {
      return antarcticaFallback(latitude, longitude, { status: response.status });
    }
    throw new Error(`Nominatim reverse geocoding failed with ${response.status}`);
  }

  const json = (await response.json()) as NominatimJson;

  // South Pole and some remote Antarctic points return "Unable to geocode".
  if (json.error || !json.address) {
    if (isAntarcticLatitude(latitude)) {
      return antarcticaFallback(latitude, longitude, json);
    }
    throw new Error(json.error ?? "Nominatim response did not include address details");
  }

  const resolved = resolveTerritoryCountryCode(json.address, latitude);
  const countryName =
    resolved.countryCode === json.address.country_code?.toUpperCase()
      ? (json.address.country ?? resolved.countryName)
      : (getCountryDisplayName(resolved.countryCode) ?? resolved.countryName);

  return {
    countryCode: resolved.countryCode,
    countryName,
    regionName:
      json.address.state ??
      json.address.province ??
      json.address.region ??
      json.address.state_district ??
      json.address.county ??
      json.address.town,
    regionCode: undefined,
    placeId: json.place_id == null ? undefined : String(json.place_id),
    osmType: json.osm_type,
    osmId: json.osm_id == null ? undefined : String(json.osm_id),
    raw: json,
  };
};
