import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110m from "world-atlas/land-110m.json" with { type: "json" };
import type { MapMedalCounts } from "./map-header.ts";
import { getPlayerNameTier } from "./player-name-style.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

const topology = land110m as unknown as Topology;
const land = feature(topology, topology.objects.land!);

type BackgroundPainter = (context: SKRSContext2D, width: number, height: number) => void;
type Bounds = [x: number, y: number, width: number, height: number];

const fillGradient = (context: SKRSContext2D, width: number, height: number, colors: string[]) => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
};

const drawWorld = (
  context: SKRSContext2D,
  [x, y, width, height]: Bounds,
  color: string,
  grid?: string,
) => {
  const projection = geoNaturalEarth1().fitExtent(
    [
      [x, y],
      [x + width, y + height],
    ],
    land,
  );
  const path = geoPath(projection, context as never);
  context.beginPath();
  path(land);
  context.fillStyle = color;
  context.fill();
  if (grid) {
    context.beginPath();
    path(geoGraticule10());
    context.strokeStyle = grid;
    context.lineWidth = 0.6;
    context.stroke();
  }
};

const drawGrid = (
  context: SKRSContext2D,
  width: number,
  height: number,
  step: number,
  color: string,
) => {
  context.beginPath();
  for (let x = 0; x < width; x += step) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = 0; y < height; y += step) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.strokeStyle = color;
  context.lineWidth = 0.5;
  context.stroke();
};

const drawCompass = (
  context: SKRSContext2D,
  x: number,
  y: number,
  radius: number,
  bright: string,
  dim: string,
  nautical = false,
) => {
  context.save();
  context.translate(x, y);
  context.strokeStyle = dim;
  context.lineWidth = 0.8;
  for (const factor of nautical ? [0.79, 1.04, 1.14] : [0.85, 1.12]) {
    context.beginPath();
    context.arc(0, 0, radius * factor, 0, Math.PI * 2);
    context.stroke();
  }
  for (let index = 0; index < 8; index++) {
    context.save();
    context.rotate((index * Math.PI) / 4);
    const length = radius * (index % 2 ? 0.62 : 1);
    const halfWidth = radius * (index % 2 ? 0.07 : 0.14);
    context.beginPath();
    context.moveTo(0, -length);
    context.lineTo(halfWidth, 0);
    context.lineTo(0, halfWidth);
    context.closePath();
    context.fillStyle = bright;
    context.fill();
    context.beginPath();
    context.moveTo(0, -length);
    context.lineTo(-halfWidth, 0);
    context.lineTo(0, halfWidth);
    context.closePath();
    context.fillStyle = dim;
    context.fill();
    context.restore();
  }
  if (nautical) {
    for (let index = 0; index < 32; index++) {
      const angle = (index * Math.PI) / 16;
      context.beginPath();
      context.moveTo(Math.sin(angle) * radius * 1.04, Math.cos(angle) * radius * 1.04);
      context.lineTo(Math.sin(angle) * radius * 1.14, Math.cos(angle) * radius * 1.14);
      context.stroke();
    }
  }
  context.fillStyle = bright;
  context.font = 'bold 9px "DejaVu Sans", Arial, sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const [label, dx, dy] of [
    ["N", 0, -1.34],
    ["E", 1.34, 0],
    ["S", 0, 1.34],
    ["W", -1.34, 0],
  ] as const) {
    context.fillText(label, dx * radius, dy * radius);
  }
  context.restore();
};

const atlas: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#0b1b31", "#103634", "#102c40"]);
  drawGrid(context, width, height, 26, "#83e5d21c");
  drawWorld(context, [width * 0.55, 8, width * 0.31, height - 16], "#68ccb753", "#93e7d332");
  // A plotted voyage gives the grid a purpose without competing with the text.
  context.strokeStyle = "#a5eddb77";
  context.lineWidth = 1;
  context.setLineDash([4, 5]);
  context.beginPath();
  context.moveTo(width * 0.61, height * 0.58);
  context.bezierCurveTo(width * 0.7, -12, width * 0.75, height, width * 0.84, height * 0.28);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#d0fff2";
  for (const [x, y] of [
    [0.61, 0.58],
    [0.84, 0.28],
  ] as const) {
    context.beginPath();
    context.arc(width * x, height * y, 2.5, 0, Math.PI * 2);
    context.fill();
  }
  drawCompass(context, width - 100, height / 2, 43, "#b5efdf", "#6ab5af88");
};

const nautical: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#171d30", "#292831", "#42362f"]);
  const cx = width - 112;
  const cy = height / 2;
  context.strokeStyle = "#dbc29a22";
  context.lineWidth = 0.6;
  context.beginPath();
  for (let index = 0; index < 32; index++) {
    const angle = (index * Math.PI) / 16;
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * width, cy + Math.sin(angle) * width);
  }
  context.stroke();
  drawWorld(context, [width * 0.52, 10, width * 0.33, height - 20], "#d1b68c45", "#f1dbb024");
  context.setLineDash([1, 4]);
  context.strokeStyle = "#e8c89555";
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(width * 0.71, height * 0.55, width * 0.15, 34, -0.12, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  drawCompass(context, cx, cy, 49, "#f1d49b", "#a98c65", true);
};

const aurora: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#161a3d", "#253450", "#163d4a"]);
  const glow = context.createRadialGradient(width * 0.68, 0, 5, width * 0.68, 0, width * 0.46);
  glow.addColorStop(0, "#64e4c939");
  glow.addColorStop(0.55, "#9776d42b");
  glow.addColorStop(1, "#9776d400");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  // Flowing contour lines continue across the entire information bar.
  context.strokeStyle = "#c1b9fc25";
  context.lineWidth = 0.7;
  for (let index = -8; index < 21; index++) {
    context.beginPath();
    context.moveTo(0, index * 12);
    context.bezierCurveTo(
      width * 0.34,
      index * 12 - 60,
      width * 0.62,
      index * 12 + 110,
      width,
      index * 12 - 22,
    );
    context.stroke();
  }
  drawWorld(context, [width * 0.55, 8, width * 0.32, height - 16], "#91efcf61");
  drawCompass(context, width - 100, height / 2, 43, "#e2dcff", "#9ba5d588");
};

// Project real land once at each small grid size. The square cells remain sharp at 2× resolution.
const landMasks = new Map<string, Uint8Array>();
const getLandMask = (columns: number, rows: number) => {
  const key = `${columns}:${rows}`;
  const cached = landMasks.get(key);
  if (cached) return cached;
  const canvas = createCanvas(columns, rows);
  const context = canvas.getContext("2d");
  drawWorld(context, [0, 0, columns, rows], "#ffffff");
  const { data } = context.getImageData(0, 0, columns, rows);
  const mask = Uint8Array.from({ length: columns * rows }, (_, index) =>
    data[index * 4 + 3]! > 100 ? 1 : 0,
  );
  landMasks.set(key, mask);
  return mask;
};

const drawPixelWorld = (
  context: SKRSContext2D,
  x: number,
  y: number,
  cell: number,
  columns: number,
  rows: number,
  colors: readonly string[],
  gap = 0,
) => {
  const mask = getLandMask(columns, rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (!mask[row * columns + column]) continue;
      context.fillStyle = colors[(column + row * 3) % colors.length]!;
      context.fillRect(x + column * cell, y + row * cell, cell - gap, cell - gap);
    }
  }
};

const drawPixelCompass = (
  context: SKRSContext2D,
  x: number,
  y: number,
  cell: number,
  color: string,
  dim: string,
) => {
  context.save();
  context.translate(x, y);
  for (let index = 0; index < 4; index++) {
    context.save();
    context.rotate((index * Math.PI) / 2);
    context.fillStyle = color;
    for (let row = 0; row < 10; row++) {
      const halfWidth = Math.floor((9 - row) / 3);
      context.fillRect(-halfWidth * cell, -(row + 1) * cell, (halfWidth * 2 + 1) * cell, cell);
    }
    context.fillStyle = dim;
    context.fillRect(0, -7 * cell, cell, 7 * cell);
    context.restore();
  }
  context.fillStyle = color;
  context.fillRect(-cell, -cell, 3 * cell, 3 * cell);
  context.strokeStyle = dim;
  context.lineWidth = cell;
  context.strokeRect(-13 * cell, -13 * cell, 27 * cell, 27 * cell);
  context.restore();
};

const pixelAtlas: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#111d3d", "#17344a", "#12394a"]);
  drawGrid(context, width, height, 8, "#94dcff13");
  drawGrid(context, width, height, 40, "#94dcff18");
  drawPixelWorld(
    context,
    width * 0.55,
    (height - 144) / 2,
    4,
    96,
    36,
    ["#56bca9", "#66cdb5", "#49a9a0"],
    0.5,
  );
  drawPixelCompass(context, width - 110, height / 2 - 2, 4, "#b0e8ff", "#3b7f9f");
  context.fillStyle = "#e5d69e";
  for (const [x, y] of [
    [0.64, 0.38],
    [0.76, 0.26],
    [0.81, 0.68],
  ] as const) {
    const px = Math.round((width * x) / 4) * 4;
    const py = Math.round((height * y) / 4) * 4;
    context.fillRect(px - 4, py, 12, 4);
    context.fillRect(px, py - 4, 4, 12);
  }
};

const pixelVoyager: BackgroundPainter = (context, width, height) => {
  // Flat bands and square stars give this option a different retro composition.
  const bands = ["#151b3b", "#242244", "#383054", "#54385c", "#734b65", "#986074", "#bb7983"];
  for (let row = 0; row < bands.length; row++) {
    context.fillStyle = bands[row]!;
    context.fillRect(0, (row * height) / bands.length, width, Math.ceil(height / bands.length));
  }
  drawPixelWorld(context, width * 0.53, (height - 144) / 2, 3, 128, 48, [
    "#132d3b",
    "#183c46",
    "#214852",
  ]);
  context.fillStyle = "#e6deba";
  for (const [x, y] of [
    [0.52, 0.16],
    [0.61, 0.29],
    [0.77, 0.13],
    [0.86, 0.2],
    [0.97, 0.1],
  ] as const) {
    const px = Math.round((width * x) / 3) * 3;
    const py = Math.round((height * y) / 3) * 3;
    context.fillRect(px - 3, py, 9, 3);
    context.fillRect(px, py - 3, 3, 9);
  }
  drawPixelCompass(context, width - 112, height / 2 - 2, 4, "#e9d4a4", "#805f78");
};

/** Keep every option here; selecting an active design never removes the alternatives. */
export const PLAYER_MAP_HEADER_DESIGNS = {
  plain: { name: "Plain", draw: (() => {}) as BackgroundPainter },
  atlas: { name: "Atlas", draw: atlas },
  nautical: { name: "Nautical", draw: nautical },
  aurora: { name: "Aurora", draw: aurora },
  pixelAtlas: { name: "Pixel Atlas", draw: pixelAtlas },
  pixelVoyager: { name: "Pixel Voyager", draw: pixelVoyager },
} as const;

export type PlayerMapHeaderDesign = keyof typeof PLAYER_MAP_HEADER_DESIGNS;

/** Select the background for the 400+ tier; all alternatives stay in the registry above. */
export const activePlayerMapHeaderDesign: PlayerMapHeaderDesign = "atlas";

export const getPlayerMapHeaderDesign = (
  medals: MapMedalCounts,
  requested: PlayerMapHeaderDesign = activePlayerMapHeaderDesign,
): PlayerMapHeaderDesign => (getPlayerNameTier(medals) === "explorer" ? requested : "plain");

export const drawPlayerMapHeaderBackground = (
  context: SKRSContext2D,
  design: PlayerMapHeaderDesign,
  width: number,
  height: number,
) => {
  if (design === "plain") return;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  const ui = MAP_RESOLUTION_SCALE;
  context.scale(ui, ui);
  PLAYER_MAP_HEADER_DESIGNS[design].draw(context, width / ui, height / ui);
  // A translucent fade protects even long names while retaining the full-width design.
  const scrim = context.createLinearGradient(0, 0, width / ui, 0);
  scrim.addColorStop(0, "#080f2488");
  scrim.addColorStop(0.42, "#080f2477");
  scrim.addColorStop(0.74, "#080f2400");
  context.fillStyle = scrim;
  context.fillRect(0, 0, width / ui, height / ui);
  context.restore();
};
