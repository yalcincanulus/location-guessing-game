import { createCanvas } from "@napi-rs/canvas";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { MAP_RESOLUTION_SCALE, mapViewports } from "./region-presets.ts";
import { activeMapTheme } from "./themes.ts";
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

export type MapCoordinates = {
  latitude: number;
  longitude: number;
};

export type RenderMapOptions = {
  wrongCountries: string[];
  correctCountry?: string;
  viewport?: string;
  /** Exact answer location; draws a red crosshair + dot when provided. */
  marker?: MapCoordinates;
};

const buildProjection = (
  preset: NonNullable<(typeof mapViewports)[string]>,
  marker: MapCoordinates | undefined,
  correctNumericId: string | undefined,
) => {
  if (!marker) {
    return geoMercator()
      .scale(preset.scale)
      .center(preset.center)
      .translate(preset.translate);
  }

  const center: [number, number] = [marker.longitude, marker.latitude];
  const translate: [number, number] = [preset.width / 2, preset.height / 2];
  const projection = geoMercator().center(center).translate(translate);

  const country = correctNumericId
    ? countryFeatures.find((entry) => String(entry.id).padStart(3, "0") === correctNumericId)
    : undefined;

  if (country) {
    const pad = 56 * MAP_RESOLUTION_SCALE;
    projection.fitExtent(
      [
        [pad, pad],
        [preset.width - pad, preset.height - pad],
      ],
      country as never,
    );
    // Keep country framing, but pin the exact location to the canvas center.
    const minScale = 450 * MAP_RESOLUTION_SCALE;
    const maxScale = 3500 * MAP_RESOLUTION_SCALE;
    const fittedScale = projection.scale() * 0.9;
    projection
      .scale(Math.min(maxScale, Math.max(minScale, fittedScale)))
      .center(center)
      .translate(translate);
  } else {
    projection.scale(1100 * MAP_RESOLUTION_SCALE);
  }

  return projection;
};

export const renderMap = ({
  wrongCountries,
  correctCountry,
  viewport = "world",
  marker,
}: RenderMapOptions) => {
  const preset = mapViewports[viewport] ?? mapViewports.world;
  if (!preset) {
    throw new Error("World map viewport is not configured");
  }
  const wrongNumericIds = new Set(wrongCountries.map(getCountryNumericId).filter(Boolean));
  const correctNumericId = correctCountry ? getCountryNumericId(correctCountry) : undefined;
  const theme = activeMapTheme;

  const projection = buildProjection(preset, marker, correctNumericId);
  const canvas = createCanvas(preset.width, preset.height);
  const context = canvas.getContext("2d");
  const path = geoPath(projection, context as never);

  context.fillStyle = theme.ocean;
  context.fillRect(0, 0, preset.width, preset.height);

  const ui = MAP_RESOLUTION_SCALE;

  context.strokeStyle = theme.countryBorder;
  context.lineWidth = 0.45 * ui;

  for (const country of countryFeatures) {
    const id = String(country.id).padStart(3, "0");
    context.beginPath();
    path(country as never);
    context.fillStyle =
      correctNumericId && id === correctNumericId
        ? theme.correct
        : wrongNumericIds.has(id)
          ? theme.wrong
          : theme.country;
    context.fill();
    context.stroke();
  }

  if (marker) {
    const projected = projection([marker.longitude, marker.latitude]);
    if (projected) {
      const [x, y] = projected;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        context.strokeStyle = theme.locationCrosshair;
        context.lineWidth = 1.25 * ui;

        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(preset.width, y);
        context.stroke();

        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, preset.height);
        context.stroke();

        const radius = 5.5 * ui;
        context.fillStyle = theme.locationMarker;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = "#ffffffcc";
        context.lineWidth = 1.5 * ui;
        context.stroke();
      }
    }
  }

  // DejaVu is installed in the Alpine image; Arial is a host/dev fallback.
  context.font = `${16 * ui}px "DejaVu Sans", Arial, sans-serif`;
  const legendItems = [
    { color: theme.wrong, label: messages.mapLegend.wrongGuesses },
    ...(correctCountry ? [{ color: theme.correct, label: messages.mapLegend.correct }] : []),
    ...(marker ? [{ color: theme.locationMarker, label: messages.mapLegend.location }] : []),
  ];
  const rowHeight = 26 * ui;
  const paddingX = 16 * ui;
  const paddingY = 12 * ui;
  const swatchX = 20 * ui;
  const textX = 36 * ui;
  const labelWidth = Math.max(...legendItems.map((item) => context.measureText(item.label).width));
  const boxWidth = Math.ceil(textX + labelWidth + paddingX);
  const boxHeight = paddingY * 2 + legendItems.length * rowHeight - 4 * ui;
  const boxX = 16 * ui;
  const boxY = preset.height - boxHeight - 16 * ui;

  context.fillStyle = theme.legendBackground;
  context.beginPath();
  context.roundRect(boxX, boxY, boxWidth, boxHeight, 6 * ui);
  context.fill();

  legendItems.forEach((item, index) => {
    const rowY = boxY + paddingY + index * rowHeight + 8 * ui;
    context.fillStyle = item.color;
    context.beginPath();
    context.arc(boxX + swatchX, rowY, 7 * ui, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = theme.legendText;
    context.fillText(item.label, boxX + textX, rowY + 5 * ui);
  });

  return {
    buffer: canvas.toBuffer("image/png"),
    filename: `${preset.name}-guesses.png`,
    contentType: "image/png",
  };
};
