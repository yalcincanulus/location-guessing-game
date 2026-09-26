import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import provinceTopology from "./tr-provinces.topo.json" with { type: "json" };

/**
 * Türkiye's 81 provinces from Natural Earth admin-1 (public domain), simplified
 * with mapshaper. Feature ids are the two-digit plate codes.
 */
export type ProvinceFeature = {
  id: string;
  type: "Feature";
  geometry: unknown;
  properties?: Record<string, unknown>;
};

type Topology = {
  type: "Topology";
  objects: { provinces: unknown };
  arcs: unknown[];
};

const topology = provinceTopology as unknown as Topology;

export const provinceFeatures: ProvinceFeature[] = (
  feature(topology as never, topology.objects.provinces as never) as unknown as {
    features: ProvinceFeature[];
  }
).features.map((entry) => ({ ...entry, id: String(entry.id).padStart(2, "0") }));

export const provinceCollection = {
  type: "FeatureCollection" as const,
  features: provinceFeatures,
};

/** Point-in-polygon lookup. Returns the plate code, or undefined outside Türkiye. */
export const findProvinceAtPoint = (latitude: number, longitude: number) =>
  provinceFeatures.find((entry) => geoContains(entry as never, [longitude, latitude]))?.id;
