import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { mapViewports } from "./region-presets.ts";

type GeometryCollection = {
  type: "GeometryCollection";
  geometries: Array<{ id?: string | number; type: string; arcs?: unknown }>;
};

type Topology = {
  type: "Topology";
  objects: { countries: GeometryCollection };
  arcs: unknown[];
  transform?: unknown;
};

type Feature = {
  id?: string | number;
  type: "Feature";
  geometry: unknown;
  properties?: Record<string, unknown>;
};

const topology = countries110m as Topology;
const countryFeatures = (
  feature(topology as never, topology.objects.countries as never) as unknown as {
    features: Feature[];
  }
).features;

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export type RenderMapOptions = {
  wrongCountries: string[];
  correctCountry?: string;
  viewport?: string;
};

export const renderMap = ({
  wrongCountries,
  correctCountry,
  viewport = "world",
}: RenderMapOptions) => {
  const preset = mapViewports[viewport] ?? mapViewports.world;
  if (!preset) {
    throw new Error("World map viewport is not configured");
  }
  const wrongNumericIds = new Set(wrongCountries.map(getCountryNumericId).filter(Boolean));
  const correctNumericId = correctCountry ? getCountryNumericId(correctCountry) : undefined;

  const projection = geoMercator()
    .scale(preset.scale)
    .center(preset.center)
    .translate(preset.translate);
  const path = geoPath(projection);

  const paths = countryFeatures
    .map((country) => {
      const id = String(country.id).padStart(3, "0");
      const data = path(country as never);
      if (!data) {
        return "";
      }

      const fill =
        correctNumericId && id === correctNumericId
          ? "#22c55e"
          : wrongNumericIds.has(id)
            ? "#ef4444"
            : "#f1f5f9";

      return `<path d="${escapeXml(data)}" fill="${fill}" stroke="#475569" stroke-width="0.45"/>`;
    })
    .join("\n");

  const title = correctCountry
    ? `Wrong guesses: ${wrongCountries.length}; correct: ${correctCountry}`
    : `Wrong guesses: ${wrongCountries.length}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${preset.width}" height="${preset.height}" viewBox="0 0 ${preset.width} ${preset.height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="100%" height="100%" fill="#dbeafe"/>
  <g>${paths}</g>
  <rect x="16" y="${preset.height - 54}" width="300" height="38" rx="6" fill="#0f172a" opacity="0.88"/>
  <circle cx="36" cy="${preset.height - 35}" r="7" fill="#ef4444"/>
  <text x="52" y="${preset.height - 30}" font-family="Arial, sans-serif" font-size="16" fill="#ffffff">Wrong guesses</text>
  ${
    correctCountry
      ? `<circle cx="190" cy="${preset.height - 35}" r="7" fill="#22c55e"/><text x="206" y="${preset.height - 30}" font-family="Arial, sans-serif" font-size="16" fill="#ffffff">Correct</text>`
      : ""
  }
</svg>`;

  return {
    buffer: Buffer.from(svg),
    filename: `${preset.name}-guesses.svg`,
    contentType: "image/svg+xml",
  };
};
