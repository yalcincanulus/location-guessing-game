import { geoArea, geoCentroid } from "d3-geo";
import type { GameMode } from "../game/game-mode.ts";
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { provinceFeatures } from "../provinces/province-geometry.ts";
import { countryFeatures } from "./map-renderer.ts";

export type LonLat = [longitude: number, latitude: number];

type Geometry = { type: string; coordinates: unknown };

const countriesById = new Map(countryFeatures.map((entry) => [String(entry.id), entry]));

/** The main landmass's centroid, so France stays in Europe rather than drifting toward French Guiana. */
const mainlandCentroid = (geometry: Geometry): LonLat => {
  if (geometry.type !== "MultiPolygon") {
    return geoCentroid(geometry as never) as LonLat;
  }
  const polygons = (geometry.coordinates as unknown[]).map((coordinates) => ({
    type: "Polygon",
    coordinates,
  }));
  const largest = polygons.reduce((best, polygon) =>
    geoArea(polygon as never) > geoArea(best as never) ? polygon : best,
  );
  return geoCentroid(largest as never) as LonLat;
};

const cache = new Map<string, LonLat | undefined>();

/** Centroid of a country (ISO alpha-2) or a province (plate code), or undefined if unknown. */
export const getLocationCentroid = (mode: GameMode, code: string): LonLat | undefined => {
  const key = `${mode}:${code}`;
  if (cache.has(key)) return cache.get(key);
  const geometry =
    mode === "province"
      ? (provinceFeatures.find((entry) => entry.id === code)?.geometry as Geometry | undefined)
      : (countriesById.get(getCountryNumericId(code) ?? "")?.geometry as Geometry | undefined);
  const centroid = geometry ? mainlandCentroid(geometry) : undefined;
  cache.set(key, centroid);
  return centroid;
};
