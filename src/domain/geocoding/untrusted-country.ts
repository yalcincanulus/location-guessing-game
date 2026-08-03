const UNTRUSTED_REVERSE_GEOCODE_COUNTRY_CODES = new Set(["FK", "GS"]);

export const isUntrustedReverseGeocodeCountry = (countryCode: string) =>
  UNTRUSTED_REVERSE_GEOCODE_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
