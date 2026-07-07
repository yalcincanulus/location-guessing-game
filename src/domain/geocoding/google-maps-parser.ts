export type ParsedGoogleMapsUrl = {
  originalUrl: string;
  resolvedUrl: string;
  latitude: number;
  longitude: number;
  source: string;
};

const urlPattern = /https?:\/\/[^\s<>()]+/gi;

const validateCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const parsePair = (
  latitude: string,
  longitude: string,
  source: string,
  originalUrl: string,
  resolvedUrl: string,
) => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!validateCoordinate(lat, lon)) {
    return undefined;
  }

  return { originalUrl, resolvedUrl, latitude: lat, longitude: lon, source };
};

const extractFromUrl = (value: string, originalUrl = value): ParsedGoogleMapsUrl | undefined => {
  const decoded = decodeURIComponent(value);

  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|z)/);
  if (atMatch?.[1] && atMatch[2]) {
    return parsePair(atMatch[1], atMatch[2], "google-at-coordinate", originalUrl, value);
  }

  const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch?.[1] && bangMatch[2]) {
    return parsePair(bangMatch[1], bangMatch[2], "google-bang-coordinate", originalUrl, value);
  }

  const queryMatch = decoded.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (queryMatch?.[1] && queryMatch[2]) {
    return parsePair(queryMatch[1], queryMatch[2], "google-query-coordinate", originalUrl, value);
  }

  const genericPair = decoded.match(/(?:^|[^\d-])(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)(?:[^\d]|$)/);
  if (genericPair?.[1] && genericPair[2]) {
    return parsePair(genericPair[1], genericPair[2], "generic-coordinate", originalUrl, value);
  }

  return undefined;
};

const resolveUrl = async (url: string) => {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(7000),
  }).catch(() => undefined);

  return response?.url ?? url;
};

export const findGoogleMapsUrl = (message: string) => {
  const urls = message.match(urlPattern) ?? [];
  return urls.find((url) =>
    /(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)/i.test(url),
  );
};

export const parseGoogleMapsUrl = async (url: string): Promise<ParsedGoogleMapsUrl | undefined> => {
  const direct = extractFromUrl(url);
  if (direct) {
    return direct;
  }

  const resolvedUrl = await resolveUrl(url);
  return extractFromUrl(resolvedUrl, url);
};
