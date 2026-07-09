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

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
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
      "Accept-Language": "en",
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
