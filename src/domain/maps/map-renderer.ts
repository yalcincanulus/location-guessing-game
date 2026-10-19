import { createCanvas } from "@napi-rs/canvas";
import { geoBounds, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import { getCountryNumericId } from "../countries/normalize-country-guess.ts";
import { MAP_RESOLUTION_SCALE, mapViewports } from "./region-presets.ts";
import { activeMapTheme, memorialMapTheme, type MapTheme } from "./themes.ts";
import { toMonochrome } from "./monochrome.ts";
import { messages } from "../../i18n/messages.ts";
import type { NationalHoliday } from "../holidays/national-holidays.ts";
import { drawFramedTurkishFlag } from "./turkish-flag.ts";
import {
  drawMapHeader,
  MAP_HEADER_HEIGHT,
  type MapHeader,
  type MapHighlights,
} from "./map-header.ts";

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

type Ring = Array<[number, number]>;

const ANTARCTICA_NUMERIC_ID = "010";
const POLE_CAP_LATITUDE = -89.99;

/**
 * world-atlas stores mainland Antarctica as a tiny ring at -89.999° with the coastline as its hole.
 * d3's antimeridian clip misreads that pair for some rotations and floods the whole canvas
 * (e.g. rotating to -71.2337799°). The coastline ring alone already winds around the pole correctly.
 */
const dropAntarcticaPoleCap = (country: Feature): Feature => {
  if (String(country.id).padStart(3, "0") !== ANTARCTICA_NUMERIC_ID) {
    return country;
  }
  const geometry = country.geometry as { type: string; coordinates: Ring[][] };
  if (geometry.type !== "MultiPolygon") {
    return country;
  }
  const isPoleCap = (ring: Ring) => ring.every(([, latitude]) => latitude <= POLE_CAP_LATITUDE);
  return {
    ...country,
    geometry: {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon[0] && isPoleCap(polygon[0]) ? polygon.slice(1) : polygon,
      ),
    },
  };
};

const topology = countries50m as Topology;
export const countryFeatures = (
  feature(topology as never, topology.objects.countries as never) as unknown as {
    features: Feature[];
  }
).features.map(dropAntarcticaPoleCap);

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
  highlights?: MapHighlights;
  header?: MapHeader;
  /** Adds the Turkish flag to the map's top-left corner. */
  holiday?: NationalHoliday;
  /** 10 November: black and white, with hatched wrong guesses. */
  mourning?: boolean;
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
type Fill = string | ReturnType<CanvasContext["createPattern"]>;

export const mapThemeFor = (mourning?: boolean): MapTheme =>
  mourning ? memorialMapTheme : activeMapTheme;

/** Wrong-guess fill: diagonal hatching when the theme has no colour to spare. */
export const wrongGuessFill = (context: CanvasContext, theme: MapTheme): Fill => {
  if (!theme.wrongHatch) {
    return theme.wrong;
  }
  const ui = MAP_RESOLUTION_SCALE;
  const size = 7 * ui;
  const tile = createCanvas(size, size);
  const tileContext = tile.getContext("2d");
  tileContext.fillStyle = theme.wrong;
  tileContext.fillRect(0, 0, size, size);
  tileContext.strokeStyle = theme.wrongHatch;
  tileContext.lineWidth = 1.6 * ui;
  // The main diagonal plus the two corner pieces, so stripes join across tiles.
  for (const offset of [-size, 0, size]) {
    tileContext.beginPath();
    tileContext.moveTo(offset, size);
    tileContext.lineTo(offset + size, 0);
    tileContext.stroke();
  }
  return context.createPattern(tile, "repeat");
};

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

  drawMarkerDot(context, x, y, theme);
};

/** Dot and ring for the location, shared by the map and its legend. */
const drawMarkerDot = (context: CanvasContext, x: number, y: number, theme: MapTheme) => {
  const ui = MAP_RESOLUTION_SCALE;
  const radius = 5.5 * ui;
  context.fillStyle = theme.locationMarker;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = theme.locationMarkerRing ?? "#ffffffcc";
  context.lineWidth = 1.5 * ui;
  context.stroke();
  if (theme.locationMarkerRing) {
    // A dark outer edge keeps the white ring visible on the white answer.
    context.strokeStyle = theme.locationMarker;
    context.lineWidth = ui;
    context.beginPath();
    context.arc(x, y, radius + 1.25 * ui, 0, Math.PI * 2);
    context.stroke();
  }
};

export type LegendItem = { label: string } & (
  | { fill: Fill; marker?: false }
  /** Draws the location marker itself as the swatch. */
  | { marker: true }
);

/** Light edge so small hatched countries and islands still show up. */
export const strokeWrongGuess = (context: CanvasContext, theme: MapTheme) => {
  context.save();
  context.strokeStyle = theme.wrongHatch ?? theme.wrong;
  context.lineWidth = 0.9 * MAP_RESOLUTION_SCALE;
  context.stroke();
  context.restore();
};

/** Legend rows for a guess map; the swatches use the same fills as the map. */
export const guessMapLegend = (
  context: CanvasContext,
  theme: MapTheme,
  {
    highlights,
    hasCorrect,
    hasMarker,
  }: { highlights?: MapHighlights; hasCorrect: boolean; hasMarker: boolean },
): LegendItem[] => [
  highlights
    ? { fill: highlights.color, label: highlights.label }
    : { fill: wrongGuessFill(context, theme), label: messages.mapLegend.wrongGuesses },
  ...(hasCorrect ? [{ fill: theme.correct, label: messages.mapLegend.correct }] : []),
  ...(hasMarker ? [{ marker: true as const, label: messages.mapLegend.location }] : []),
];

/** Bottom-left legend box. */
export const drawLegend = (
  context: CanvasContext,
  theme: MapTheme,
  legendItems: LegendItem[],
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
    if (item.marker) {
      drawMarkerDot(context, boxX + swatchX, rowY, theme);
    } else {
      context.fillStyle = item.fill;
      context.beginPath();
      context.arc(boxX + swatchX, rowY, 7 * ui, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = theme.legendText;
    context.fillText(item.label, boxX + textX, rowY + 5 * ui);
  });
};

/** Holiday Turkish flag in the map's top-left corner. */
export const drawMapHolidayFlag = (context: CanvasContext) => {
  const ui = MAP_RESOLUTION_SCALE;
  drawFramedTurkishFlag(context, 16 * ui, 16 * ui, 40 * ui, ui);
};

export const renderMap = ({
  wrongCountries,
  correctCountry,
  viewport = "world",
  marker,
  highlights,
  header,
  holiday,
  mourning,
}: RenderMapOptions) => {
  const preset = mapViewports[viewport] ?? mapViewports.world;
  if (!preset) {
    throw new Error("World map viewport is not configured");
  }
  const wrongNumericIds = new Set(wrongCountries.map(getCountryNumericId).filter(Boolean));
  const correctNumericId = correctCountry ? getCountryNumericId(correctCountry) : undefined;
  const highlightedNumericIds = new Set(highlights?.codes.map(getCountryNumericId).filter(Boolean));
  const theme = mapThemeFor(mourning);

  const projection = buildProjection(preset, marker, correctNumericId);
  const headerHeight = header ? MAP_HEADER_HEIGHT : 0;
  const canvas = createCanvas(preset.width, preset.height + headerHeight);
  const context = canvas.getContext("2d");
  context.save();
  context.translate(0, headerHeight);
  const path = geoPath(projection, context as never);

  context.fillStyle = theme.ocean;
  context.fillRect(0, 0, preset.width, preset.height);

  const ui = MAP_RESOLUTION_SCALE;

  context.strokeStyle = theme.countryBorder;
  context.lineWidth = 0.45 * ui;
  const wrongFill = wrongGuessFill(context, theme);

  const drawCountries = (countries: Feature[]) => {
    for (const country of countries) {
      const id = String(country.id).padStart(3, "0");
      context.beginPath();
      path(country as never);
      context.fillStyle =
        correctNumericId && id === correctNumericId
          ? theme.correct
          : wrongNumericIds.has(id)
            ? wrongFill
            : highlights && highlightedNumericIds.has(id)
              ? highlights.color
              : theme.country;
      context.fill();
      context.stroke();
      if (theme.wrongHatch && wrongNumericIds.has(id) && id !== correctNumericId) {
        strokeWrongGuess(context, theme);
      }
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
    guessMapLegend(context, theme, {
      highlights,
      hasCorrect: Boolean(correctCountry),
      hasMarker: Boolean(marker),
    }),
    preset.height,
  );
  if (holiday) {
    drawMapHolidayFlag(context);
  }

  context.restore();
  if (header) {
    drawMapHeader(context, header, theme, preset.width);
  }
  if (mourning) {
    // The map is already grey; this settles the header art.
    toMonochrome(context, canvas.width, canvas.height);
  }

  return {
    buffer: canvas.toBuffer("image/png"),
    filename: `${preset.name}-guesses.png`,
    contentType: "image/png",
  };
};
