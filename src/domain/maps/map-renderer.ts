import { createCanvas } from "@napi-rs/canvas";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { mapViewports } from "./region-presets.ts";
import { messages } from "../../i18n/messages.ts";

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

const topology = countries50m as Topology;
const countryFeatures = (
  feature(topology as never, topology.objects.countries as never) as unknown as {
    features: Feature[];
  }
).features;

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
  const canvas = createCanvas(preset.width, preset.height);
  const context = canvas.getContext("2d");
  const path = geoPath(projection, context as never);

  context.fillStyle = "#dbeafe";
  context.fillRect(0, 0, preset.width, preset.height);

  context.strokeStyle = "#475569";
  context.lineWidth = 0.45;

  for (const country of countryFeatures) {
    const id = String(country.id).padStart(3, "0");
    context.beginPath();
    path(country as never);
    context.fillStyle =
      correctNumericId && id === correctNumericId
        ? "#22c55e"
        : wrongNumericIds.has(id)
          ? "#ef4444"
          : "#f1f5f9";
    context.fill();
    context.stroke();
  }

  context.fillStyle = "rgba(15, 23, 42, 0.88)";
  context.beginPath();
  context.roundRect(16, preset.height - 54, correctCountry ? 300 : 166, 38, 6);
  context.fill();

  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#ef4444";
  context.beginPath();
  context.arc(36, preset.height - 35, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.fillText(messages.mapLegend.wrongGuesses, 52, preset.height - 30);

  if (correctCountry) {
    context.fillStyle = "#22c55e";
    context.beginPath();
    context.arc(190, preset.height - 35, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.fillText(messages.mapLegend.correct, 206, preset.height - 30);
  }

  return {
    buffer: canvas.toBuffer("image/png"),
    filename: `${preset.name}-guesses.png`,
    contentType: "image/png",
  };
};
