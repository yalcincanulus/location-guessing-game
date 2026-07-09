/**
 * Nominatim often returns the parent country_code (e.g. "fr") for overseas
 * departments/territories, with the real place encoded in ISO3166-2-* fields
 * (e.g. "FR-RE") or the state name ("Réunion").
 */
const iso3166ToTerritory = new Map<string, string>([
  // France
  ["FR-RE", "RE"],
  ["FR-974", "RE"],
  ["FR-GP", "GP"],
  ["FR-971", "GP"],
  ["FR-MQ", "MQ"],
  ["FR-972", "MQ"],
  ["FR-GF", "GF"],
  ["FR-973", "GF"],
  ["FR-YT", "YT"],
  ["FR-976", "YT"],
  ["FR-NC", "NC"],
  ["FR-PF", "PF"],
  ["FR-BL", "BL"],
  ["FR-MF", "MF"],
  ["FR-PM", "PM"],
  ["FR-TF", "TF"],
  ["FR-WF", "WF"],

  // United States
  ["US-PR", "PR"],
  ["US-VI", "VI"],
  ["US-GU", "GU"],
  ["US-AS", "AS"],
  ["US-MP", "MP"],

  // China SARs
  ["CN-HK", "HK"],
  ["CN-MO", "MO"],

  // Netherlands
  ["NL-AW", "AW"],
  ["NL-CW", "CW"],
  ["NL-SX", "SX"],
  ["NL-BQ", "BQ"],

  // Denmark
  ["DK-GL", "GL"],
  ["DK-FO", "FO"],

  // Finland
  ["FI-01", "AX"],

  // Australia
  ["AU-CC", "CC"],
  ["AU-CX", "CX"],
  ["AU-NF", "NF"],

  // New Zealand
  ["NZ-CK", "CK"],
  ["NZ-NU", "NU"],
  ["NZ-TK", "TK"],
]);

const normalizePlaceName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Fallback when ISO3166-2 fields are missing but the state/region name is clear. */
const placeNameToTerritory = new Map<string, string>([
  ["reunion", "RE"],
  ["la reunion", "RE"],
  ["guadeloupe", "GP"],
  ["martinique", "MQ"],
  ["french guiana", "GF"],
  ["guyane", "GF"],
  ["guyane francaise", "GF"],
  ["mayotte", "YT"],
  ["new caledonia", "NC"],
  ["nouvelle caledonie", "NC"],
  ["french polynesia", "PF"],
  ["polynesie francaise", "PF"],
  ["saint barthelemy", "BL"],
  ["st barthelemy", "BL"],
  ["saint martin", "MF"],
  ["st martin", "MF"],
  ["saint pierre and miquelon", "PM"],
  ["wallis and futuna", "WF"],
  ["puerto rico", "PR"],
  ["hong kong", "HK"],
  ["macao", "MO"],
  ["macau", "MO"],
  ["greenland", "GL"],
  ["faroe islands", "FO"],
  ["aruba", "AW"],
  ["curacao", "CW"],
  ["sint maarten", "SX"],
]);

export type NominatimAddress = {
  country?: string;
  country_code?: string;
  state?: string;
  province?: string;
  region?: string;
  county?: string;
  state_district?: string;
  municipality?: string;
  town?: string;
  [key: string]: string | undefined;
};

/** Antarctic Treaty latitude: south of 60°S is treated as Antarctica (AQ). */
export const ANTARCTICA_LATITUDE_THRESHOLD = -60;

export const isAntarcticLatitude = (latitude: number) => latitude <= ANTARCTICA_LATITUDE_THRESHOLD;

export const resolveTerritoryCountryCode = (
  address: NominatimAddress,
  latitude?: number,
): { countryCode: string; countryName?: string } => {
  for (const [key, value] of Object.entries(address)) {
    if (!key.startsWith("ISO3166-2-") || !value) {
      continue;
    }
    const territory = iso3166ToTerritory.get(value.toUpperCase());
    if (territory) {
      return { countryCode: territory, countryName: address.state ?? address.country };
    }
  }

  const placeCandidates = [
    address.state,
    address.province,
    address.region,
    address.state_district,
    address.municipality,
    address.country,
    address.town,
  ].filter(Boolean) as string[];

  for (const place of placeCandidates) {
    const territory = placeNameToTerritory.get(normalizePlaceName(place));
    if (territory) {
      return { countryCode: territory, countryName: place };
    }
  }

  const parentCode = address.country_code?.toUpperCase();
  if (parentCode) {
    return { countryCode: parentCode, countryName: address.country };
  }

  // Nominatim often omits country_code for Antarctic locations.
  if (latitude != null && isAntarcticLatitude(latitude)) {
    return { countryCode: "AQ", countryName: "Antarctica" };
  }

  throw new Error("Nominatim response did not include a country code");
};
