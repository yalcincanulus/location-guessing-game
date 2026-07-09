import { createCanvas } from "@napi-rs/canvas";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { mapViewports } from "./region-presets.ts";
import { messages } from "../../i18n/messages.ts";

// old colors
// export const mapColors = {
//   ocean: "#dbeafe",
//   country: "#f1f5f9",
//   countryBorder: "#475569",
//   wrong: "#ef4444",
//   correct: "#22c55e",
//   legendBackground: "rgba(15, 23, 42, 0.88)",
//   legendText: "#ffffff",
// } as const;

export const mapColors = {
  ocean: "#dbeafe",
  country: "#f1f5f9",
  countryBorder: "#475569",
  wrong: "#ef4444",
  correct: "#22c55e",
  legendBackground: "#0f172ae0",
  legendText: "#ffffff",
} as const;

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

  context.fillStyle = mapColors.ocean;
  context.fillRect(0, 0, preset.width, preset.height);

  context.strokeStyle = mapColors.countryBorder;
  context.lineWidth = 0.45;

  for (const country of countryFeatures) {
    const id = String(country.id).padStart(3, "0");
    context.beginPath();
    path(country as never);
    context.fillStyle =
      correctNumericId && id === correctNumericId
        ? mapColors.correct
        : wrongNumericIds.has(id)
          ? mapColors.wrong
          : mapColors.country;
    context.fill();
    context.stroke();
  }

  context.font = "16px Arial, sans-serif";
  const legendItems = [
    { color: mapColors.wrong, label: messages.mapLegend.wrongGuesses },
    ...(correctCountry ? [{ color: mapColors.correct, label: messages.mapLegend.correct }] : []),
  ];
  const rowHeight = 26;
  const paddingX = 16;
  const paddingY = 12;
  const swatchX = 20;
  const textX = 36;
  const labelWidth = Math.max(...legendItems.map((item) => context.measureText(item.label).width));
  const boxWidth = Math.ceil(textX + labelWidth + paddingX);
  const boxHeight = paddingY * 2 + legendItems.length * rowHeight - 4;
  const boxX = 16;
  const boxY = preset.height - boxHeight - 16;

  context.fillStyle = mapColors.legendBackground;
  context.beginPath();
  context.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
  context.fill();

  legendItems.forEach((item, index) => {
    const rowY = boxY + paddingY + index * rowHeight + 8;
    context.fillStyle = item.color;
    context.beginPath();
    context.arc(boxX + swatchX, rowY, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = mapColors.legendText;
    context.fillText(item.label, boxX + textX, rowY + 5);
  });

  return {
    buffer: canvas.toBuffer("image/png"),
    filename: `${preset.name}-guesses.png`,
    contentType: "image/png",
  };
};
