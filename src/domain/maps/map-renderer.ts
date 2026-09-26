import { createCanvas } from "@napi-rs/canvas";
import { geoBounds, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { MAP_RESOLUTION_SCALE, mapViewports } from "./region-presets.ts";
import { activeMapTheme, type MapTheme } from "./themes.ts";
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

export type Feature = {
  id?: string | number;
  type: "Feature";
  geometry: unknown;
  properties?: Record<string, unknown>;
};

const topology = countries50m as Topology;
export const countryFeatures = (
  feature(topology as never, topology.objects.countries as never) as unknown as {
    features: Feature[];
  }
).features;

/** JPEG quality 0–100. Flat choropleth fills compress well; 90 stays sharp in Discord. */
export const MAP_JPEG_QUALITY = 90;

/** Countries whose geometry can appear on a ±360° Mercator tile at the world-view edges. */
const wrapsAntimeridian = (country: Feature) => {
  const [[west], [east]] = geoBounds(country as never);
  return east < west || west < -140 || east > 140;
};

const wrapCountryFeatures = countryFeatures.filter(wrapsAntimeridian);

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

type MapProjection = ReturnType<typeof geoMercator>;

/** Frame so [longitude, latitude] lands at `translate`, with the antimeridian cut opposite the view. */
const frameProjection = (
  projection: MapProjection,
  longitude: number,
  latitude: number,
  translate: [number, number],
  scale?: number,
) => {
  projection.rotate([-longitude, 0]).center([0, latitude]).translate(translate);
  if (scale != null) {
    projection.scale(scale);
  }
  return projection;
};

const buildProjection = (
  preset: NonNullable<(typeof mapViewports)[string]>,
  marker: MapCoordinates | undefined,
  correctNumericId: string | undefined,
) => {
  if (!marker) {
    // Same rotate framing as zoomed maps so regional views near ±180° wrap correctly.
    return frameProjection(
      geoMercator().scale(preset.scale),
      preset.center[0],
      preset.center[1],
      preset.translate,
    );
  }

  const translate: [number, number] = [preset.width / 2, preset.height / 2];
  const projection = frameProjection(geoMercator(), marker.longitude, marker.latitude, translate);

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
    frameProjection(
      projection,
      marker.longitude,
      marker.latitude,
      translate,
      Math.min(maxScale, Math.max(minScale, fittedScale)),
    );
  } else {
    frameProjection(
      projection,
      marker.longitude,
      marker.latitude,
      translate,
      1100 * MAP_RESOLUTION_SCALE,
    );
  }

  return projection;
};

/** Mercator world width in pixels; shift translate by this to tile horizontally across ±180°. */
const mercatorWorldWidth = (projection: MapProjection) => 2 * Math.PI * projection.scale();

type CanvasContext = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

/** Red crosshair + dot on the exact answer location. */
export const drawLocationMarker = (
  context: CanvasContext,
  projection: MapProjection,
  marker: MapCoordinates,
  width: number,
  height: number,
  theme: MapTheme,
) => {
  const projected = projection([marker.longitude, marker.latitude]);
  if (!projected) {
    return;
  }
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }
  const ui = MAP_RESOLUTION_SCALE;
  context.strokeStyle = theme.locationCrosshair;
  context.lineWidth = 1.25 * ui;

  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width, y);
  context.stroke();

  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();

  const radius = 5.5 * ui;
  context.fillStyle = theme.locationMarker;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffffffcc";
  context.lineWidth = 1.5 * ui;
  context.stroke();
};

/** Bottom-left legend box. */
export const drawLegend = (
  context: CanvasContext,
  theme: MapTheme,
  legendItems: Array<{ color: string; label: string }>,
  height: number,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  // DejaVu is installed in the Alpine image; Arial is a host/dev fallback.
  context.font = `${16 * ui}px "DejaVu Sans", Arial, sans-serif`;
  const rowHeight = 26 * ui;
  const paddingX = 16 * ui;
  const paddingY = 12 * ui;
  const swatchX = 20 * ui;
  const textX = 36 * ui;
  const labelWidth = Math.max(...legendItems.map((item) => context.measureText(item.label).width));
  const boxWidth = Math.ceil(textX + labelWidth + paddingX);
  const boxHeight = paddingY * 2 + legendItems.length * rowHeight - 4 * ui;
  const boxX = 16 * ui;
  const boxY = height - boxHeight - 16 * ui;

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

  const drawCountries = (countries: Feature[]) => {
    for (const country of countries) {
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
  };

  const [baseTx, baseTy] = projection.translate();
  const wrapPeriod = mercatorWorldWidth(projection);
  // Draw three horizontal tiles so geography continues past ±180° instead of hard-clipping.
  // Side tiles only need countries that can appear there (Alaska, Chukotka, Fiji, …).
  for (const [shift, countries] of [
    [-wrapPeriod, wrapCountryFeatures],
    [0, countryFeatures],
    [wrapPeriod, wrapCountryFeatures],
  ] as const) {
    projection.translate([baseTx + shift, baseTy]);
    drawCountries(countries);
  }
  projection.translate([baseTx, baseTy]);

  if (marker) {
    drawLocationMarker(context, projection, marker, preset.width, preset.height, theme);
  }

  drawLegend(
    context,
    theme,
    [
      { color: theme.wrong, label: messages.mapLegend.wrongGuesses },
      ...(correctCountry ? [{ color: theme.correct, label: messages.mapLegend.correct }] : []),
      ...(marker ? [{ color: theme.locationMarker, label: messages.mapLegend.location }] : []),
    ],
    preset.height,
  );

  return {
    buffer: canvas.toBuffer("image/jpeg", MAP_JPEG_QUALITY),
    filename: `${preset.name}-guesses.jpg`,
    contentType: "image/jpeg",
  };
};
