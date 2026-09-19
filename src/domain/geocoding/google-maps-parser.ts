export type PanoramaCoverageSource = "google" | "third-party" | "unknown";

export type ParsedGoogleMapsUrl = {
  originalUrl: string;
  resolvedUrl: string;
  latitude: number;
  longitude: number;
  source: string;
  coverageSource: PanoramaCoverageSource;
};

const urlPattern = /https?:\/\/[^\s<>()]+/gi;

const validateCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

/**
 * Google Maps Street View URLs encode the panorama owner after the pano id:
 * - !2e0  → official Google coverage
 * - !2e10 → third-party / user photosphere
 */
export const detectPanoramaCoverageSource = (...urls: string[]): PanoramaCoverageSource => {
  for (const url of urls) {
    const decoded = decodeURIComponent(url);
    if (/!2e10(?:!|$)/.test(decoded)) {
      return "third-party";
    }
    if (/!2e0(?:!|$)/.test(decoded)) {
      return "google";
    }
  }

  return "unknown";
};

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

  return {
    originalUrl,
    resolvedUrl,
    latitude: lat,
    longitude: lon,
    source,
    coverageSource: detectPanoramaCoverageSource(originalUrl, resolvedUrl),
  };
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

type PanoImageType = 2 | 10;

const extractPanoRef = (value: string): { id: string; imageType: PanoImageType } | undefined => {
  const decoded = decodeURIComponent(value);
  const typed = decoded.match(/!1s([A-Za-z0-9_-]{10,})!2e(0|10)(?![0-9])/);
  if (typed?.[1] && typed[2]) {
    return { id: typed[1], imageType: typed[2] === "10" ? 10 : 2 };
  }

  const query = decoded.match(/[?&](?:pano|panoid)=([A-Za-z0-9_-]{10,})/i);
  if (!query?.[1]) {
    return undefined;
  }

  return {
    id: query[1],
    imageType: detectPanoramaCoverageSource(decoded) === "third-party" ? 10 : 2,
  };
};

const asLatLng = (value: unknown): { latitude: number; longitude: number } | undefined => {
  if (!Array.isArray(value) || value.length < 4) {
    return undefined;
  }
  if (value[0] !== null || value[1] !== null) {
    return undefined;
  }
  const latitude = value[2];
  const longitude = value[3];
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }
  if (!validateCoordinate(latitude, longitude)) {
    return undefined;
  }
  return { latitude, longitude };
};

const findLatLng = (value: unknown): { latitude: number; longitude: number } | undefined => {
  const direct = asLatLng(value);
  if (direct) {
    return direct;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  for (const child of value) {
    const found = findLatLng(child);
    if (found) {
      return found;
    }
  }
  return undefined;
};

const parsePanoMetadataCoordinates = (text: string) => {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) {
    return undefined;
  }

  let data: unknown;
  try {
    data = JSON.parse(text.slice(start + 1, end));
  } catch {
    return undefined;
  }

  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[0][0] !== 0) {
    return undefined;
  }

  return findLatLng(data);
};

const panoMetadataUrl = (panoId: string, imageType: PanoImageType) =>
  `https://maps.googleapis.com/maps/api/js/GeoPhotoService.GetMetadata?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m2!1sen!2sUS!3m3!1m2!1e${imageType}!2s${panoId}!4m6!1e1!1e2!1e3!1e4!1e8!1e6&callback=_xdc_._m`;

const resolveFromPanoId = async (
  value: string,
  originalUrl: string,
  fetchImpl: typeof fetch,
): Promise<ParsedGoogleMapsUrl | undefined> => {
  const pano = extractPanoRef(value);
  if (!pano) {
    return undefined;
  }

  const response = await fetchImpl(panoMetadataUrl(pano.id, pano.imageType), {
    signal: AbortSignal.timeout(7000),
  }).catch(() => undefined);
  if (!response?.ok) {
    return undefined;
  }

  const text = await response.text().catch(() => undefined);
  if (!text) {
    return undefined;
  }

  const coords = parsePanoMetadataCoordinates(text);
  if (!coords) {
    return undefined;
  }

  return {
    originalUrl,
    resolvedUrl: value,
    latitude: coords.latitude,
    longitude: coords.longitude,
    source: "google-pano-metadata",
    coverageSource: detectPanoramaCoverageSource(originalUrl, value),
  };
};

const resolveUrl = async (url: string, fetchImpl: typeof fetch) => {
  const response = await fetchImpl(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(7000),
  }).catch(() => undefined);

  return response?.url || url;
};

export const findGoogleMapsUrl = (message: string) => {
  const urls = message.match(urlPattern) ?? [];
  return urls.find((url) =>
    /(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)/i.test(url),
  );
};

export const parseGoogleMapsUrl = async (
  url: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<ParsedGoogleMapsUrl | undefined> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const direct = extractFromUrl(url);
  if (direct) {
    return direct;
  }

  const fromOriginalPano = await resolveFromPanoId(url, url, fetchImpl);
  if (fromOriginalPano) {
    return fromOriginalPano;
  }

  const resolvedUrl = await resolveUrl(url, fetchImpl);
  if (resolvedUrl === url) {
    return undefined;
  }

  const fromResolved = extractFromUrl(resolvedUrl, url);
  if (fromResolved) {
    return fromResolved;
  }

  return resolveFromPanoId(resolvedUrl, url, fetchImpl);
};
