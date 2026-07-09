import { env } from "../../config/env.ts";
import { getCountryDisplayName } from "../countries/normalize-country-guess.ts";
import { resolveTerritoryCountryCode, type NominatimAddress } from "./resolve-territory-code.ts";

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
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  address?: NominatimAddress;
};

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
    throw new Error(`Nominatim reverse geocoding failed with ${response.status}`);
  }

  const json = (await response.json()) as NominatimJson;
  if (!json.address) {
    throw new Error("Nominatim response did not include address details");
  }

  const resolved = resolveTerritoryCountryCode(json.address);
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
      json.address.county,
    regionCode: undefined,
    placeId: json.place_id == null ? undefined : String(json.place_id),
    osmType: json.osm_type,
    osmId: json.osm_id == null ? undefined : String(json.osm_id),
    raw: json,
  };
};
