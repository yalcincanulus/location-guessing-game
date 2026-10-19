import { createCanvas } from "@napi-rs/canvas";
import { geoMercator, geoPath } from "d3-geo";
import { mesh } from "topojson-client";
import provinceTopology from "../provinces/tr-provinces.topo.json" with { type: "json" };
import { provinceCollection, provinceFeatures } from "../provinces/province-geometry.ts";
import {
  countryFeatures,
  drawLegend,
  drawMapHolidayFlag,
  drawLocationMarker,
  guessMapLegend,
  strokeWrongGuess,
  mapThemeFor,
  wrongGuessFill,
  type MapCoordinates,
} from "./map-renderer.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";
import { toMonochrome } from "./monochrome.ts";
import { messages } from "../../i18n/messages.ts";
import type { NationalHoliday } from "../holidays/national-holidays.ts";
import {
  drawMapHeader,
  MAP_HEADER_HEIGHT,
  type MapHeader,
  type MapHighlights,
} from "./map-header.ts";

export const TURKEY_MAP_VIEWPORT = "turkey";

/** Base size before `MAP_RESOLUTION_SCALE`. Türkiye is about 2.5 times wider than tall. */
const BASE_WIDTH = 1400;
const BASE_HEIGHT = 720;

/** ISO 3166-1 numeric id for Türkiye in world-atlas. Provinces are drawn in its place. */
const TURKEY_NUMERIC_ID = "792";

/** Outer border of Türkiye: arcs used by one province only. */
const turkeyOutline = mesh(
  provinceTopology as never,
  (provinceTopology as unknown as { objects: { provinces: never } }).objects.provinces,
  (left: unknown, right: unknown) => left === right,
);

export type RenderProvinceMapOptions = {
  wrongProvinces: string[];
  correctProvince?: string;
  /** Exact answer location; draws a red crosshair + dot when provided. */
  marker?: MapCoordinates;
  highlights?: MapHighlights;
  header?: MapHeader;
  /** Adds the Turkish flag to the map's top-left corner. */
  holiday?: NationalHoliday;
  /** 10 November: black and white, with hatched wrong guesses. */
  mourning?: boolean;
};

export const renderProvinceMap = ({
  wrongProvinces,
  correctProvince,
  marker,
  highlights,
  header,
  holiday,
  mourning,
}: RenderProvinceMapOptions) => {
  const ui = MAP_RESOLUTION_SCALE;
  const width = BASE_WIDTH * ui;
  const height = BASE_HEIGHT * ui;
  const theme = mapThemeFor(mourning);
  const wrong = new Set(wrongProvinces);
  const highlighted = new Set(highlights?.codes);

  const pad = 28 * ui;
  const projection = geoMercator().fitExtent(
    [
      [pad, pad],
      [width - pad, height - pad],
    ],
    provinceCollection as never,
  );

  const headerHeight = header ? MAP_HEADER_HEIGHT : 0;
  const canvas = createCanvas(width, height + headerHeight);
  const context = canvas.getContext("2d");
  context.save();
  context.translate(0, headerHeight);
  const path = geoPath(projection, context as never);

  context.fillStyle = theme.ocean;
  context.fillRect(0, 0, width, height);

  // Neighbouring countries, dimmed so Türkiye stands out.
  context.globalAlpha = 0.45;
  context.fillStyle = theme.country;
  context.strokeStyle = theme.countryBorder;
  context.lineWidth = 0.6 * ui;
  for (const country of countryFeatures) {
    if (String(country.id).padStart(3, "0") === TURKEY_NUMERIC_ID) {
      continue;
    }
    context.beginPath();
    path(country as never);
    context.fill();
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = theme.countryBorder;
  context.lineWidth = 0.8 * ui;
  const wrongFill = wrongGuessFill(context, theme);
  for (const province of provinceFeatures) {
    context.beginPath();
    path(province as never);
    context.fillStyle =
      correctProvince && province.id === correctProvince
        ? theme.correct
        : wrong.has(province.id)
          ? wrongFill
          : highlights && highlighted.has(province.id)
            ? highlights.color
            : theme.country;
    context.fill();
    context.stroke();
    if (theme.wrongHatch && wrong.has(province.id) && province.id !== correctProvince) {
      strokeWrongGuess(context, theme);
    }
  }

  context.beginPath();
  path(turkeyOutline as never);
  context.lineWidth = 1.6 * ui;
  context.stroke();

  if (marker) {
    drawLocationMarker(context, projection, marker, width, height, theme);
  }

  drawLegend(
    context,
    theme,
    guessMapLegend(context, theme, {
      highlights,
      hasCorrect: Boolean(correctProvince),
      hasMarker: Boolean(marker),
    }),
    height,
  );
  if (holiday) {
    drawMapHolidayFlag(context);
  }

  context.restore();
  if (header) {
    drawMapHeader(context, header, theme, width);
  }
  if (mourning) {
    toMonochrome(context, canvas.width, canvas.height);
  }

  return {
    buffer: canvas.toBuffer("image/png"),
    filename: messages.filenames.turkeyGuesses,
    contentType: "image/png",
  };
};
