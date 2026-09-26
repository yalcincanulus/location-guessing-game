import { createCanvas } from "@napi-rs/canvas";
import { geoMercator, geoPath } from "d3-geo";
import { mesh } from "topojson-client";
import provinceTopology from "../provinces/tr-provinces.topo.json" with { type: "json" };
import { provinceCollection, provinceFeatures } from "../provinces/province-geometry.ts";
import {
  countryFeatures,
  drawLegend,
  drawLocationMarker,
  MAP_JPEG_QUALITY,
  type MapCoordinates,
} from "./map-renderer.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";
import { activeMapTheme } from "./themes.ts";
import { messages } from "../../i18n/messages.ts";

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
};

export const renderProvinceMap = ({
  wrongProvinces,
  correctProvince,
  marker,
}: RenderProvinceMapOptions) => {
  const ui = MAP_RESOLUTION_SCALE;
  const width = BASE_WIDTH * ui;
  const height = BASE_HEIGHT * ui;
  const theme = activeMapTheme;
  const wrong = new Set(wrongProvinces);

  const pad = 28 * ui;
  const projection = geoMercator().fitExtent(
    [
      [pad, pad],
      [width - pad, height - pad],
    ],
    provinceCollection as never,
  );

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
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
  for (const province of provinceFeatures) {
    context.beginPath();
    path(province as never);
    context.fillStyle =
      correctProvince && province.id === correctProvince
        ? theme.correct
        : wrong.has(province.id)
          ? theme.wrong
          : theme.country;
    context.fill();
    context.stroke();
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
    [
      { color: theme.wrong, label: messages.mapLegend.wrongGuesses },
      ...(correctProvince ? [{ color: theme.correct, label: messages.mapLegend.correct }] : []),
      ...(marker ? [{ color: theme.locationMarker, label: messages.mapLegend.location }] : []),
    ],
    height,
  );

  return {
    buffer: canvas.toBuffer("image/jpeg", MAP_JPEG_QUALITY),
    filename: messages.filenames.turkeyGuesses,
    contentType: "image/jpeg",
  };
};
