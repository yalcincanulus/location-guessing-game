import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  geoDistance,
  geoGraticule10,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110m from "world-atlas/land-110m.json" with { type: "json" };
import type { GameMode } from "../game/game-mode.ts";
import { provinceCollection } from "../provinces/province-geometry.ts";
import type { LonLat } from "./location-centroids.ts";
import type { MapMedalCounts } from "./map-header.ts";
import {
  getPlayerNameStyle,
  getPlayerNameTier,
  LEGEND_NAME_STYLES,
  type PlayerNameStyle,
} from "./player-name-style.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

const topology = land110m as unknown as Topology;
const land = feature(topology, topology.objects.land!);

export type PassportStamp = {
  /** ISO country code or province plate code. */
  code: string;
  /** Upper-case display name in the bot's locale. */
  name: string;
  count: number;
  /** Where to mark the location on map-based designs. */
  coordinates?: LonLat;
};

export type HeaderDetails = {
  /** The player's most-won locations, most wins first. */
  stamps?: PassportStamp[];
  mode?: GameMode;
};

type BackgroundPainter = (
  context: SKRSContext2D,
  width: number,
  height: number,
  details: HeaderDetails,
) => void;
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

// Legend (500+) helpers. A fixed seed keeps every render of a design identical.
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const drawStarField = (
  context: SKRSContext2D,
  width: number,
  height: number,
  count: number,
  seed: number,
  colors: readonly string[],
) => {
  const random = seededRandom(seed);
  context.save();
  for (let index = 0; index < count; index++) {
    const x = random() * width;
    const y = random() * height;
    const radius = random() ** 3 * 1.5 + 0.3;
    context.globalAlpha = 0.3 + random() * 0.7;
    context.fillStyle = colors[index % colors.length]!;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

const fillGlow = (
  context: SKRSContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  transparent: string,
) => {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, transparent);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
};

/** A bright point with long horizontal and vertical light spikes. */
const drawFlare = (context: SKRSContext2D, x: number, y: number, size: number, color: string) => {
  fillGlow(context, x, y, size * 1.4, `${color}88`, `${color}00`);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y - size * 2.4);
  context.lineTo(x + size * 0.18, y - size * 0.18);
  context.lineTo(x + size * 2.4, y);
  context.lineTo(x + size * 0.18, y + size * 0.18);
  context.lineTo(x, y + size * 2.4);
  context.lineTo(x - size * 0.18, y + size * 0.18);
  context.lineTo(x - size * 2.4, y);
  context.lineTo(x - size * 0.18, y - size * 0.18);
  context.closePath();
  context.fill();
};

type GlobeColors = {
  oceanLight: string;
  oceanDark: string;
  land: string;
  grid: string;
  atmosphere: string;
  atmosphereEnd: string;
};

const drawGlobe = (
  context: SKRSContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: [number, number],
  colors: GlobeColors,
) => {
  const projection = geoOrthographic()
    .rotate(rotation)
    .translate([x, y])
    .scale(radius)
    .clipAngle(90);
  const path = geoPath(projection, context as never);
  const atmosphere = context.createRadialGradient(x, y, radius * 0.92, x, y, radius * 1.32);
  atmosphere.addColorStop(0, colors.atmosphere);
  atmosphere.addColorStop(1, colors.atmosphereEnd);
  context.fillStyle = atmosphere;
  context.beginPath();
  context.arc(x, y, radius * 1.32, 0, Math.PI * 2);
  context.fill();
  const ocean = context.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.1,
    x,
    y,
    radius,
  );
  ocean.addColorStop(0, colors.oceanLight);
  ocean.addColorStop(1, colors.oceanDark);
  context.fillStyle = ocean;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  path(geoGraticule10());
  context.strokeStyle = colors.grid;
  context.lineWidth = 0.6;
  context.stroke();
  context.beginPath();
  path(land);
  context.fillStyle = colors.land;
  context.fill();
  // Night falls on the lower right so the globe reads as a sphere.
  const shade = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  shade.addColorStop(0.45, "#00000000");
  shade.addColorStop(1, "#000000a0");
  context.fillStyle = shade;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
};

const celestial: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#05081a", "#140e3a", "#0a1f3f"]);
  fillGlow(context, width * 0.66, height * 0.15, 170, "#7c3aed48", "#7c3aed00");
  fillGlow(context, width * 0.88, height * 0.95, 190, "#06b6d43a", "#06b6d400");
  fillGlow(context, width * 0.52, height * 0.75, 130, "#ec489926", "#ec489900");
  drawStarField(context, width, height, 280, 7, ["#ffffff", "#c7d2fe", "#a5f3fc", "#fde68a"]);
  // A small constellation fills the space between the text and the globe.
  const stars = [
    [0.57, 0.66],
    [0.6, 0.38],
    [0.645, 0.5],
    [0.69, 0.24],
    [0.73, 0.42],
  ] as const;
  context.strokeStyle = "#c4b5fd70";
  context.lineWidth = 0.8;
  context.beginPath();
  stars.forEach(([sx, sy], index) => {
    const method = index === 0 ? "moveTo" : "lineTo";
    context[method](width * sx, height * sy);
  });
  context.stroke();
  for (const [sx, sy] of stars) {
    drawFlare(context, width * sx, height * sy, 2.6, "#e0e7ff");
  }
  const globeX = width - 140;
  const globeY = height / 2;
  const orbit = (start: number, end: number, color: string) => {
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.beginPath();
    context.ellipse(globeX, globeY, 104, 22, -0.3, start, end);
    context.stroke();
  };
  orbit(Math.PI, Math.PI * 2, "#c4b5fd55");
  drawGlobe(context, globeX, globeY, 54, [-35, -22], {
    oceanLight: "#2f6fd1",
    oceanDark: "#0a1433",
    land: "#8fe9ffd0",
    grid: "#a5f3fc2a",
    atmosphere: "#60a5fa99",
    atmosphereEnd: "#60a5fa00",
  });
  orbit(0, Math.PI, "#e0e7ffaa");
  const moonAngle = 0.55;
  const moonX =
    globeX + Math.cos(moonAngle) * 104 * Math.cos(-0.3) - Math.sin(moonAngle) * 22 * Math.sin(-0.3);
  const moonY =
    globeY + Math.cos(moonAngle) * 104 * Math.sin(-0.3) + Math.sin(moonAngle) * 22 * Math.cos(-0.3);
  fillGlow(context, moonX, moonY, 9, "#fde68aaa", "#fde68a00");
  context.fillStyle = "#fef3c7";
  context.beginPath();
  context.arc(moonX, moonY, 3.4, 0, Math.PI * 2);
  context.fill();
  drawFlare(context, width * 0.94, height * 0.18, 3.4, "#ffffff");
  drawFlare(context, width * 0.8, height * 0.85, 2.4, "#a5f3fc");
};

const drawLaurel = (
  context: SKRSContext2D,
  x: number,
  y: number,
  radius: number,
  side: 1 | -1,
  color: string,
) => {
  context.save();
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.4;
  context.beginPath();
  const start = Math.PI / 2 + side * 0.35;
  const end = Math.PI / 2 + side * 2.55;
  context.arc(x, y, radius, start, end, side < 0);
  context.stroke();
  for (let index = 0; index < 9; index++) {
    const angle = start + ((end - start) * (index + 0.5)) / 9;
    const lx = x + Math.cos(angle) * radius;
    const ly = y + Math.sin(angle) * radius;
    for (const offset of [-1, 1]) {
      context.save();
      context.translate(lx, ly);
      context.rotate(angle + (side * Math.PI) / 2 + offset * 0.75 * side);
      context.beginPath();
      context.ellipse(0, -6, 2.6, 6.5, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  context.restore();
};

/** A double gold frame with corner diamonds. */
const drawGoldFrame = (context: SKRSContext2D, width: number, height: number) => {
  context.strokeStyle = "#f5c542a0";
  context.lineWidth = 1.2;
  context.strokeRect(5, 5, width - 10, height - 10);
  context.strokeStyle = "#f5c54255";
  context.lineWidth = 0.6;
  context.strokeRect(10, 10, width - 20, height - 20);
  context.fillStyle = "#f5c542";
  for (const [x, y] of [
    [10, 10],
    [width - 10, 10],
    [10, height - 10],
    [width - 10, height - 10],
  ] as const) {
    context.beginPath();
    context.moveTo(x, y - 5);
    context.lineTo(x + 5, y);
    context.lineTo(x, y + 5);
    context.lineTo(x - 5, y);
    context.closePath();
    context.fill();
  }
};

const royal: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#22071a", "#4a0d24", "#2a0b33"]);
  // A gold damask lattice covers the whole bar.
  context.strokeStyle = "#f5c54216";
  context.lineWidth = 0.7;
  context.beginPath();
  for (let offset = -height; offset < width + height; offset += 22) {
    context.moveTo(offset, 0);
    context.lineTo(offset + height, height);
    context.moveTo(offset + height, 0);
    context.lineTo(offset, height);
  }
  context.stroke();
  context.fillStyle = "#f5c54230";
  for (let column = 0; column * 11 < width; column++) {
    for (let row = column % 2; row * 11 < height; row += 2) {
      context.fillRect(column * 11 - 1, row * 11 - 1, 2, 2);
    }
  }
  fillGlow(context, width - 112, height / 2, 150, "#f59e0b33", "#f59e0b00");
  drawWorld(context, [width * 0.5, 14, width * 0.29, height - 28], "#e9c46a48", "#f5c54226");
  const cx = width - 112;
  const cy = height / 2;
  context.fillStyle = "#f5c54224";
  for (let index = 0; index < 24; index++) {
    const angle = (index * Math.PI) / 12;
    context.beginPath();
    context.moveTo(cx + Math.cos(angle - 0.06) * 48, cy + Math.sin(angle - 0.06) * 48);
    context.lineTo(
      cx + Math.cos(angle) * (index % 2 ? 78 : 96),
      cy + Math.sin(angle) * (index % 2 ? 78 : 96),
    );
    context.lineTo(cx + Math.cos(angle + 0.06) * 48, cy + Math.sin(angle + 0.06) * 48);
    context.closePath();
    context.fill();
  }
  drawLaurel(context, cx, cy, 58, 1, "#e8b84a");
  drawLaurel(context, cx, cy, 58, -1, "#e8b84a");
  const ring = context.createLinearGradient(cx, cy - 46, cx, cy + 46);
  ring.addColorStop(0, "#fff2b0");
  ring.addColorStop(0.5, "#d4a017");
  ring.addColorStop(1, "#7a4a08");
  context.fillStyle = ring;
  context.beginPath();
  context.arc(cx, cy, 45, 0, Math.PI * 2);
  context.fill();
  drawGlobe(context, cx, cy, 38, [-30, -30], {
    oceanLight: "#7a1c3d",
    oceanDark: "#2a0716",
    land: "#f5c542dd",
    grid: "#f5c54238",
    atmosphere: "#00000000",
    atmosphereEnd: "#00000000",
  });
  drawGoldFrame(context, width, height);
};

const RAINBOW = ["#ff6ad5", "#ffd36a", "#6affb0", "#6ad8ff", "#b06aff"] as const;

const prismatic: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#0c0a1f", "#16123a", "#0d1b2e"]);
  // Holographic foil: soft rainbow bands that repeat across the bar.
  const foil = context.createLinearGradient(0, 0, width, height * 3);
  [...RAINBOW, ...RAINBOW, RAINBOW[0]].forEach((color, index, colors) =>
    foil.addColorStop(index / (colors.length - 1), `${color}26`),
  );
  context.fillStyle = foil;
  context.fillRect(0, 0, width, height);
  // Triangular facets catch the light like cut crystal.
  context.strokeStyle = "#ffffff12";
  context.lineWidth = 0.6;
  context.beginPath();
  const step = 30;
  const rise = step * Math.tan(Math.PI / 3);
  for (let y = 0; y <= height; y += rise / 2) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  for (let x = -height; x < width + height; x += step) {
    context.moveTo(x, 0);
    context.lineTo(x + height / Math.tan(Math.PI / 3), height);
    context.moveTo(x, 0);
    context.lineTo(x - height / Math.tan(Math.PI / 3), height);
  }
  context.stroke();
  for (const [x, w] of [
    [0.5, 40],
    [0.63, 18],
    [0.77, 56],
  ] as const) {
    const streak = context.createLinearGradient(width * x, 0, width * x + w, 0);
    streak.addColorStop(0, "#ffffff00");
    streak.addColorStop(0.5, "#ffffff1c");
    streak.addColorStop(1, "#ffffff00");
    context.fillStyle = streak;
    context.beginPath();
    context.moveTo(width * x + 40, 0);
    context.lineTo(width * x + 40 + w, 0);
    context.lineTo(width * x + w - 40, height);
    context.lineTo(width * x - 40, height);
    context.closePath();
    context.fill();
  }
  const bounds: Bounds = [width * 0.48, 12, width * 0.3, height - 24];
  const projection = geoNaturalEarth1().fitExtent(
    [
      [bounds[0], bounds[1]],
      [bounds[0] + bounds[2], bounds[1] + bounds[3]],
    ],
    land,
  );
  const path = geoPath(projection, context as never);
  context.beginPath();
  path(land);
  context.fillStyle = "#ffffff22";
  context.fill();
  const edge = context.createLinearGradient(bounds[0], 0, bounds[0] + bounds[2], 0);
  RAINBOW.forEach((color, index) => edge.addColorStop(index / (RAINBOW.length - 1), color));
  context.strokeStyle = edge;
  context.lineWidth = 0.9;
  context.stroke();
  // A prism splits a white beam into the rainbow that runs off the right edge.
  const cx = width - 130;
  const cy = height / 2 + 4;
  const top: [number, number] = [cx, cy - 46];
  const left: [number, number] = [cx - 42, cy + 32];
  const right: [number, number] = [cx + 42, cy + 32];
  const entry: [number, number] = [cx - 22, cy - 6];
  const exit: [number, number] = [cx + 20, cy - 2];
  context.save();
  context.shadowColor = "#ffffff";
  context.shadowBlur = 8;
  context.strokeStyle = "#ffffffdd";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(cx - 150, cy + 22);
  context.lineTo(...entry);
  context.stroke();
  context.restore();
  const spread = 20;
  RAINBOW.forEach((color, index) => {
    context.fillStyle = `${color}99`;
    context.beginPath();
    context.moveTo(...exit);
    context.lineTo(width, cy - 30 + index * spread);
    context.lineTo(width, cy - 30 + (index + 1) * spread);
    context.closePath();
    context.fill();
  });
  const glass = context.createLinearGradient(left[0], top[1], right[0], left[1]);
  glass.addColorStop(0, "#ffffff40");
  glass.addColorStop(0.5, "#c4b5fd1a");
  glass.addColorStop(1, "#a5f3fc33");
  context.fillStyle = glass;
  context.strokeStyle = "#ffffffd0";
  context.lineWidth = 1.3;
  context.beginPath();
  context.moveTo(...top);
  context.lineTo(...right);
  context.lineTo(...left);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "#ffffff55";
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(...entry);
  context.lineTo(...exit);
  context.stroke();
  drawFlare(context, top[0], top[1], 4, "#ffffff");
  drawFlare(context, width * 0.58, height * 0.22, 2.6, "#ffffff");
  drawFlare(context, width * 0.71, height * 0.8, 2.2, "#ffe4f5");
};

const eclipse: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#050505", "#140d05", "#1d1206"]);
  drawStarField(context, width, height, 220, 23, ["#ffd98a", "#fff3d6", "#ffb347"]);
  const cx = width - 125;
  const cy = height / 2;
  context.strokeStyle = "#ffd98a16";
  context.lineWidth = 0.8;
  for (let radius = 70; radius < 400; radius += 32) {
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
  }
  drawWorld(context, [width * 0.47, 16, width * 0.27, height - 32], "#ffd98a2a", "#ffd98a16");
  const corona = context.createRadialGradient(cx, cy, 38, cx, cy, 120);
  corona.addColorStop(0, "#fff3d6ee");
  corona.addColorStop(0.18, "#ffd98a99");
  corona.addColorStop(0.5, "#ff8c1a2e");
  corona.addColorStop(1, "#ff8c1a00");
  context.fillStyle = corona;
  context.beginPath();
  context.arc(cx, cy, 120, 0, Math.PI * 2);
  context.fill();
  // Uneven streamers give the corona its wispy solar look.
  const random = seededRandom(41);
  context.lineCap = "round";
  for (let index = 0; index < 72; index++) {
    const angle = (index / 72) * Math.PI * 2 + random() * 0.05;
    const length = 52 + random() ** 2 * 80;
    const ray = context.createLinearGradient(
      cx + Math.cos(angle) * 40,
      cy + Math.sin(angle) * 40,
      cx + Math.cos(angle) * length,
      cy + Math.sin(angle) * length,
    );
    ray.addColorStop(0, "#fff3d6aa");
    ray.addColorStop(1, "#ffd98a00");
    context.strokeStyle = ray;
    context.lineWidth = 0.6 + random() * 1.2;
    context.beginPath();
    context.moveTo(cx + Math.cos(angle) * 40, cy + Math.sin(angle) * 40);
    context.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    context.stroke();
  }
  context.save();
  context.shadowColor = "#fff3d6";
  context.shadowBlur = 12;
  context.fillStyle = "#050302";
  context.strokeStyle = "#fff3d6";
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(cx, cy, 40, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
  // The diamond-ring flash just before totality.
  drawFlare(context, cx + Math.cos(-0.75) * 40, cy + Math.sin(-0.75) * 40, 6, "#fffaf0");
  drawFlare(context, width * 0.6, height * 0.25, 2.2, "#ffd98a");
  drawFlare(context, width * 0.7, height * 0.78, 1.8, "#fff3d6");
};

// Atlas variants keep its palette, grid and compass but replace the gridded world.
const atlasBase = (context: SKRSContext2D, width: number, height: number) => {
  fillGradient(context, width, height, ["#0b1b31", "#103634", "#102c40"]);
  drawGrid(context, width, height, 26, "#83e5d21c");
};

const atlasCompass = (context: SKRSContext2D, width: number, height: number) =>
  drawCompass(context, width - 100, height / 2, 43, "#b5efdf", "#6ab5af88");

const atlasGlobe: BackgroundPainter = (context, width, height) => {
  atlasBase(context, width, height);
  const x = width * 0.7;
  const y = height / 2;
  context.strokeStyle = "#a5eddb44";
  context.lineWidth = 1;
  context.setLineDash([4, 5]);
  context.beginPath();
  context.ellipse(x, y, 96, 24, -0.25, Math.PI, Math.PI * 2);
  context.stroke();
  drawGlobe(context, x, y, 56, [-30, -28], {
    oceanLight: "#1d5e63",
    oceanDark: "#0a1d2b",
    land: "#7dd9c2d8",
    grid: "#00000000",
    atmosphere: "#83e5d266",
    atmosphereEnd: "#83e5d200",
  });
  context.strokeStyle = "#a5eddb99";
  context.beginPath();
  context.ellipse(x, y, 96, 24, -0.25, 0, Math.PI);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#d0fff2";
  for (const angle of [0.5, 2.4]) {
    const px = x + Math.cos(angle) * 96 * Math.cos(-0.25) - Math.sin(angle) * 24 * Math.sin(-0.25);
    const py = y + Math.cos(angle) * 96 * Math.sin(-0.25) + Math.sin(angle) * 24 * Math.cos(-0.25);
    context.beginPath();
    context.arc(px, py, 2.5, 0, Math.PI * 2);
    context.fill();
  }
  atlasCompass(context, width, height);
};

const atlasDots: BackgroundPainter = (context, width, height) => {
  atlasBase(context, width, height);
  const columns = 84;
  const rows = 43;
  const cell = 3.4;
  const mask = getLandMask(columns, rows);
  const left = width * 0.53;
  const top = (height - rows * cell) / 2;
  const glow = context.createRadialGradient(
    width * 0.66,
    height / 2,
    0,
    width * 0.66,
    height / 2,
    190,
  );
  glow.addColorStop(0, "#68ccb72a");
  glow.addColorStop(1, "#68ccb700");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (!mask[row * columns + column]) continue;
      context.fillStyle = (column * 7 + row * 3) % 11 === 0 ? "#c9fff0" : "#68ccb7a8";
      context.beginPath();
      context.arc(left + column * cell, top + row * cell, 1.15, 0, Math.PI * 2);
      context.fill();
    }
  }
  // A few highlighted "visited" spots echo the player's win map.
  for (const [column, row] of [
    [47, 12],
    [27, 30],
    [74, 32],
  ] as const) {
    const px = left + column * cell;
    const py = top + row * cell;
    context.fillStyle = "#d0fff244";
    context.beginPath();
    context.arc(px, py, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e6fffa";
    context.beginPath();
    context.arc(px, py, 2.4, 0, Math.PI * 2);
    context.fill();
  }
  atlasCompass(context, width, height);
};

const ROUTE_CITIES = {
  istanbul: [28.97, 41.01],
  london: [-0.12, 51.5],
  newYork: [-74, 40.7],
  rio: [-43.2, -22.9],
  capeTown: [18.4, -33.9],
  mumbai: [72.8, 19],
  tokyo: [139.7, 35.7],
  sydney: [151.2, -33.9],
} as const satisfies Record<string, [number, number]>;

const atlasRoutes: BackgroundPainter = (context, width, height) => {
  atlasBase(context, width, height);
  const projection = geoNaturalEarth1().fitExtent(
    [
      [width * 0.55, 10],
      [width * 0.86, height - 10],
    ],
    land,
  );
  const path = geoPath(projection, context as never);
  context.beginPath();
  path(land);
  context.fillStyle = "#68ccb72e";
  context.fill();
  context.strokeStyle = "#93e7d340";
  context.lineWidth = 0.6;
  context.stroke();
  const point = (city: keyof typeof ROUTE_CITIES) => projection(ROUTE_CITIES[city])!;
  const routes: Array<[keyof typeof ROUTE_CITIES, keyof typeof ROUTE_CITIES]> = [
    ["istanbul", "london"],
    ["istanbul", "newYork"],
    ["istanbul", "tokyo"],
    ["istanbul", "capeTown"],
    ["istanbul", "mumbai"],
    ["newYork", "rio"],
    ["mumbai", "sydney"],
  ];
  context.lineWidth = 1;
  context.setLineDash([3, 4]);
  for (const [from, to] of routes) {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    const lift = Math.hypot(x2 - x1, y2 - y1) * 0.35;
    context.strokeStyle = "#a5eddb99";
    context.beginPath();
    context.moveTo(x1, y1);
    context.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - lift, x2, y2);
    context.stroke();
  }
  context.setLineDash([]);
  for (const city of Object.keys(ROUTE_CITIES) as Array<keyof typeof ROUTE_CITIES>) {
    const [x, y] = point(city);
    const hub = city === "istanbul";
    context.fillStyle = hub ? "#d0fff255" : "#d0fff233";
    context.beginPath();
    context.arc(x, y, hub ? 7 : 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e6fffa";
    context.beginPath();
    context.arc(x, y, hub ? 3 : 2, 0, Math.PI * 2);
    context.fill();
  }
  atlasCompass(context, width, height);
};

const atlasTopo: BackgroundPainter = (context, width, height) => {
  atlasBase(context, width, height);
  // Wavy closed rings read as elevation contours around two summits.
  for (const [cx, cy, rings, phase] of [
    [width * 0.66, height * 0.55, 9, 0.4],
    [width * 0.8, height * 0.2, 6, 2.1],
  ] as const) {
    for (let ring = 1; ring <= rings; ring++) {
      const radius = ring * 11;
      context.strokeStyle = ring % 3 === 0 ? "#93e7d350" : "#93e7d326";
      context.lineWidth = ring % 3 === 0 ? 1 : 0.7;
      context.beginPath();
      for (let step = 0; step <= 96; step++) {
        const angle = (step / 96) * Math.PI * 2;
        const wobble =
          1 + 0.16 * Math.sin(3 * angle + phase + ring * 0.25) + 0.08 * Math.sin(5 * angle - phase);
        const px = cx + Math.cos(angle) * radius * wobble * 1.5;
        const py = cy + Math.sin(angle) * radius * wobble;
        if (step === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.stroke();
    }
  }
  // A dashed trail climbs to a map pin on the main summit.
  const pinX = width * 0.66;
  const pinY = height * 0.55;
  context.strokeStyle = "#a5eddb88";
  context.lineWidth = 1;
  context.setLineDash([4, 5]);
  context.beginPath();
  context.moveTo(width * 0.53, height * 0.95);
  context.bezierCurveTo(width * 0.57, height * 0.5, width * 0.6, height * 0.9, pinX, pinY + 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#d0fff2";
  context.beginPath();
  context.arc(pinX, pinY - 16, 8, Math.PI * 0.85, Math.PI * 0.15);
  context.lineTo(pinX, pinY);
  context.closePath();
  context.fill();
  context.fillStyle = "#103634";
  context.beginPath();
  context.arc(pinX, pinY - 16, 3, 0, Math.PI * 2);
  context.fill();
  atlasCompass(context, width, height);
};

// Explorer themes without a world map. They keep the Atlas palette and stay flatter than legend.
const EXPLORER_INK = "#a5eddb";

const drawArcText = (
  context: SKRSContext2D,
  text: string,
  radius: number,
  startAngle: number,
  spread: number,
) => {
  const characters = Array.from(text);
  characters.forEach((character, index) => {
    const angle = startAngle + (spread * (index + 0.5)) / characters.length;
    context.save();
    context.rotate(angle);
    context.fillText(character, 0, -radius);
    context.restore();
  });
};

/** Shown when no player data is supplied, as in previews. */
const SAMPLE_STAMPS: Record<GameMode, PassportStamp[]> = {
  country: [
    { code: "TR", name: "TÜRKİYE", count: 24, coordinates: [35.4, 39.1] },
    { code: "JP", name: "JAPONYA", count: 15, coordinates: [138.5, 36.5] },
    { code: "BR", name: "BREZİLYA", count: 11, coordinates: [-52, -10.5] },
    { code: "FR", name: "FRANSA", count: 8, coordinates: [2.5, 46.6] },
    { code: "ZA", name: "GÜNEY AFRİKA", count: 5, coordinates: [24.7, -29] },
    { code: "AU", name: "AVUSTRALYA", count: 3, coordinates: [134, -25.5] },
  ],
  province: [
    { code: "34", name: "İSTANBUL", count: 24, coordinates: [28.6, 41.2] },
    { code: "06", name: "ANKARA", count: 15, coordinates: [32.6, 39.8] },
    { code: "35", name: "İZMİR", count: 11, coordinates: [27.5, 38.4] },
    { code: "07", name: "ANTALYA", count: 8, coordinates: [30.9, 36.9] },
    { code: "61", name: "TRABZON", count: 5, coordinates: [39.7, 40.8] },
    { code: "63", name: "ŞANLIURFA", count: 3, coordinates: [38.9, 37.3] },
  ],
};

const stampsFor = (details: HeaderDetails) =>
  details.stamps ?? SAMPLE_STAMPS[details.mode ?? "country"];

/** Slots in rank order: the most-won location gets the largest, clearest stamp on the right. */
const PASSPORT_SLOTS = [
  { x: 0.86, y: 0.47, round: true, scale: 1.15, alpha: "d8" },
  { x: 0.72, y: 0.6, round: false, scale: 1, alpha: "b8" },
  { x: 0.965, y: 0.72, round: true, scale: 0.9, alpha: "a0" },
  { x: 0.62, y: 0.34, round: true, scale: 0.95, alpha: "90" },
  { x: 0.76, y: 0.18, round: false, scale: 0.85, alpha: "80" },
  { x: 0.53, y: 0.74, round: false, scale: 0.85, alpha: "60" },
] as const;

/** The largest font, down to `minSize`, that fits; longer text is shortened with an ellipsis. */
const fitStampText = (
  context: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
) => {
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    context.font = `bold ${size}px "DejaVu Sans", Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return text;
  }
  const characters = Array.from(text);
  while (characters.length > 1 && context.measureText(`${characters.join("")}…`).width > maxWidth) {
    characters.pop();
  }
  return `${characters.join("")}…`;
};

const drawRoundStamp = (context: SKRSContext2D, stamp: PassportStamp) => {
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 38, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(0, 0, 26, 0, Math.PI * 2);
  context.stroke();
  // The name follows the top of the ring; long names use a smaller font and a wider arc.
  const characters = Array.from(stamp.name);
  const fontSize = characters.length > 10 ? 6 : 7;
  const step = characters.length > 10 ? 0.2 : 0.26;
  const name = characters.length > 21 ? `${characters.slice(0, 20).join("")}…` : stamp.name;
  const spread = Math.min(4.2, Array.from(name).length * step);
  context.font = `bold ${fontSize}px "DejaVu Sans", Arial, sans-serif`;
  drawArcText(context, name, 32, -spread / 2, spread);
  const count = Array.from(`× ${stamp.count}`);
  context.font = 'bold 7px "DejaVu Sans", Arial, sans-serif';
  const countSpread = count.length * 0.17;
  // Along the bottom, upright letters read left to right as the angle decreases.
  count.forEach((character, index) => {
    context.save();
    context.rotate(countSpread / 2 - (countSpread * (index + 0.5)) / count.length);
    context.fillText(character, 0, 33);
    context.restore();
  });
  context.font = `bold ${stamp.code.length > 2 ? 15 : 18}px "DejaVu Sans", Arial, sans-serif`;
  context.fillText(stamp.code, 0, 1);
};

const drawRectStamp = (context: SKRSContext2D, stamp: PassportStamp) => {
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(-46, -27, 92, 54, 6);
  context.stroke();
  context.lineWidth = 0.8;
  context.beginPath();
  context.roundRect(-41, -22, 82, 44, 4);
  context.stroke();
  context.fillText(fitStampText(context, stamp.name, 74, 8, 5.5), 0, -12);
  context.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
  context.fillText(stamp.code, 0, 2);
  context.font = 'bold 7px "DejaVu Sans", Arial, sans-serif';
  context.fillText(`× ${stamp.count}`, 0, 15);
};

type StampInk = (rank: number, alpha: string) => { color: string; glow?: string };

/** Draws up to six stamps in rank order; the least-won go first so the top stamps sit on top. */
const drawStampSet = (
  context: SKRSContext2D,
  width: number,
  height: number,
  stamps: PassportStamp[],
  ink: StampInk,
) => {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let rank = Math.min(stamps.length, PASSPORT_SLOTS.length) - 1; rank >= 0; rank--) {
    const slot = PASSPORT_SLOTS[rank]!;
    const { color, glow } = ink(rank, slot.alpha);
    context.save();
    context.translate(width * slot.x, height * slot.y);
    // Each slot keeps the same tilt on every render.
    context.rotate((seededRandom(rank + 5)() - 0.5) * 0.7);
    context.scale(slot.scale, slot.scale);
    context.strokeStyle = color;
    context.fillStyle = color;
    if (glow) {
      context.shadowColor = glow;
      context.shadowBlur = 6;
    }
    if (slot.round) drawRoundStamp(context, stamps[rank]!);
    else drawRectStamp(context, stamps[rank]!);
    context.restore();
  }
  context.restore();
};

const passport: BackgroundPainter = (context, width, height, details) => {
  atlasBase(context, width, height);
  drawStampSet(context, width, height, stampsFor(details), (_, alpha) => ({
    color: `${EXPLORER_INK}${alpha}`,
  }));
};

const ridges: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#0b1b31", "#103634", "#102c40"]);
  fillGlow(context, width * 0.8, height * 0.28, 120, "#83e5d22a", "#83e5d200");
  context.fillStyle = "#d0fff2aa";
  context.beginPath();
  context.arc(width * 0.8, height * 0.28, 13, 0, Math.PI * 2);
  context.fill();
  const layers = [
    { base: 0.5, amplitude: 0.3, color: "#2a6f6a", seed: 3 },
    { base: 0.62, amplitude: 0.26, color: "#1f5a58", seed: 8 },
    { base: 0.76, amplitude: 0.2, color: "#164645", seed: 13 },
    { base: 0.9, amplitude: 0.14, color: "#0f3536", seed: 21 },
  ];
  const left = width * 0.42;
  let summit: [number, number] = [0, height];
  layers.forEach(({ base, amplitude, color, seed }, layerIndex) => {
    const random = seededRandom(seed);
    const phase = random() * 6;
    const ridgeY = (x: number) => {
      const t = (x - left) / (width - left);
      const shape =
        0.55 * Math.sin(t * 7 + phase) ** 2 +
        0.3 * Math.sin(t * 17 + phase * 2) ** 2 +
        0.15 * Math.sin(t * 41 + phase * 3) ** 2;
      return height * (base - amplitude * shape);
    };
    const gradient = context.createLinearGradient(left, 0, width, 0);
    gradient.addColorStop(0, `${color}00`);
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(1, color);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(left, height);
    for (let x = left; x <= width; x += 6) {
      const y = ridgeY(x);
      context.lineTo(x, y);
      if (layerIndex === 1 && x > width * 0.6 && x < width * 0.9 && y < summit[1]) summit = [x, y];
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
    context.strokeStyle = "#83e5d240";
    context.lineWidth = 0.8;
    context.stroke();
  });
  // A switchback trail climbs from the foreground to a flag on the highest ridge.
  context.strokeStyle = "#d0fff299";
  context.lineWidth = 1;
  context.setLineDash([3, 4]);
  context.beginPath();
  context.moveTo(summit[0] - 70, height);
  context.lineTo(summit[0] - 20, height * 0.82);
  context.lineTo(summit[0] - 52, height * 0.68);
  context.lineTo(summit[0] - 8, height * 0.55);
  context.lineTo(summit[0], summit[1] + 2);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = "#e6fffa";
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(summit[0], summit[1]);
  context.lineTo(summit[0], summit[1] - 22);
  context.stroke();
  context.fillStyle = "#91f2d1";
  context.beginPath();
  context.moveTo(summit[0], summit[1] - 22);
  context.lineTo(summit[0] + 15, summit[1] - 17);
  context.lineTo(summit[0], summit[1] - 12);
  context.closePath();
  context.fill();
};

const sonar: BackgroundPainter = (context, width, height) => {
  atlasBase(context, width, height);
  const cx = width - 150;
  const cy = height / 2;
  context.strokeStyle = "#83e5d238";
  context.lineWidth = 0.8;
  for (let radius = 28; radius < 420; radius += 28) {
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI) / 6;
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * 420, cy + Math.sin(angle) * 420);
  }
  context.strokeStyle = "#83e5d21c";
  context.stroke();
  // The sweep fades out behind its leading edge.
  const sweepAngle = Math.PI * 1.08;
  for (let step = 0; step < 24; step++) {
    const start = sweepAngle - (step + 1) * 0.04;
    context.fillStyle = `rgba(131, 229, 210, ${0.2 * (1 - step / 24)})`;
    context.beginPath();
    context.moveTo(cx, cy);
    context.arc(cx, cy, 420, start, start + 0.041);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = "#d0fff2cc";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(cx, cy);
  context.lineTo(cx + Math.cos(sweepAngle) * 420, cy + Math.sin(sweepAngle) * 420);
  context.stroke();
  context.font = '9px "DejaVu Sans", Arial, sans-serif';
  context.textBaseline = "middle";
  for (const [angle, distance, label] of [
    [Math.PI * 1.04, 200, "41°N 29°E"],
    [Math.PI * 0.86, 120, "35°N 139°E"],
    [Math.PI * 1.22, 96, "22°S 43°W"],
    [Math.PI * 0.2, 60, "48°N 2°E"],
  ] as const) {
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    fillGlow(context, x, y, 9, "#d0fff288", "#d0fff200");
    context.fillStyle = "#e6fffa";
    context.beginPath();
    context.arc(x, y, 2.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#a5eddb99";
    context.fillText(label, x + 8, y - 8);
  }
  context.fillStyle = "#d0fff2";
  context.beginPath();
  context.arc(cx, cy, 3, 0, Math.PI * 2);
  context.fill();
};

const drawAnchor = (context: SKRSContext2D, x: number, y: number, size: number, color: string) => {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = size * 0.12;
  context.lineCap = "round";
  context.beginPath();
  context.arc(0, -size * 0.82, size * 0.16, 0, Math.PI * 2);
  context.moveTo(0, -size * 0.66);
  context.lineTo(0, size * 0.75);
  context.moveTo(-size * 0.4, -size * 0.4);
  context.lineTo(size * 0.4, -size * 0.4);
  context.moveTo(-size * 0.7, size * 0.2);
  context.quadraticCurveTo(-size * 0.6, size * 0.85, 0, size * 0.75);
  context.quadraticCurveTo(size * 0.6, size * 0.85, size * 0.7, size * 0.2);
  context.stroke();
  context.restore();
};

const seaChart: BackgroundPainter = (context, width, height) => {
  fillGradient(context, width, height, ["#0b1b31", "#103634", "#102c40"]);
  // Coastline along the top right, with depth contours stepping out to sea.
  const coast = (x: number, offset: number) => {
    const t = (x - width * 0.45) / (width * 0.55);
    return height * (0.12 + 0.2 * t + 0.1 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23)) + offset;
  };
  context.beginPath();
  context.moveTo(width * 0.45, 0);
  for (let x = width * 0.45; x <= width; x += 5) context.lineTo(x, coast(x, 0));
  context.lineTo(width, 0);
  context.closePath();
  context.fillStyle = "#2a6f6a66";
  context.fill();
  context.strokeStyle = "#a5eddb88";
  context.lineWidth = 1;
  context.stroke();
  for (const [offset, alpha] of [
    [14, "40"],
    [30, "30"],
    [52, "22"],
    [80, "18"],
  ] as const) {
    context.beginPath();
    for (let x = width * 0.45; x <= width; x += 5) {
      const y = coast(x, offset);
      if (x === width * 0.45) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = `${EXPLORER_INK}${alpha}`;
    context.lineWidth = 0.8;
    context.stroke();
  }
  // Depth soundings, as printed on real charts.
  const random = seededRandom(17);
  context.fillStyle = "#a5eddb66";
  context.font = 'italic 9px "DejaVu Sans", Arial, sans-serif';
  context.textAlign = "center";
  // One sounding per cell of a jittered grid keeps the numbers from overlapping.
  const columns = 11;
  const rows = 4;
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = width * (0.47 + ((column + 0.2 + random() * 0.6) / columns) * 0.52);
      const top = coast(x, 14);
      const y = top + ((row + 0.25 + random() * 0.5) / rows) * (height - 6 - top);
      // Leave the anchor's spot clear.
      if (y > height - 6 || Math.hypot(x - width * 0.92, y - (height * 0.7 - 14)) < 24) continue;
      const depth = Math.round((y - coast(x, 0)) / 3 + random() * 6);
      context.fillText(String(depth), x, y);
    }
  }
  context.strokeStyle = "#d0fff288";
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  context.beginPath();
  context.moveTo(width * 0.5, height * 0.92);
  context.bezierCurveTo(
    width * 0.65,
    height * 0.7,
    width * 0.78,
    height * 0.98,
    width * 0.92,
    height * 0.7,
  );
  context.stroke();
  context.setLineDash([]);
  drawAnchor(context, width * 0.92, height * 0.7 - 14, 14, "#d0fff2");
  // A small lighthouse beam marks the headland.
  const lx = width * 0.66;
  const ly = coast(width * 0.66, -4);
  const beam = context.createRadialGradient(lx, ly, 0, lx, ly, 90);
  beam.addColorStop(0, "#d0fff244");
  beam.addColorStop(1, "#d0fff200");
  context.fillStyle = beam;
  context.beginPath();
  context.moveTo(lx, ly);
  context.arc(lx, ly, 90, 0.35, 0.75);
  context.closePath();
  context.fill();
  context.fillStyle = "#e6fffa";
  context.beginPath();
  context.arc(lx, ly, 3, 0, Math.PI * 2);
  context.fill();
};

// Legend options built on the player's own wins.
const shapeFor = (mode: GameMode) => (mode === "province" ? provinceCollection : land);

const fitShape = (mode: GameMode, [x, y, width, height]: Bounds) =>
  (mode === "province" ? geoMercator() : geoNaturalEarth1()).fitExtent(
    [
      [x, y],
      [x + width, y + height],
    ],
    shapeFor(mode) as never,
  );

const shapeMasks = new Map<string, Uint8Array>();
/** One cell per pixel; the same fitted projection scaled by the cell size places dots on land. */
const getShapeMask = (mode: GameMode, columns: number, rows: number) => {
  const key = `${mode}:${columns}:${rows}`;
  const cached = shapeMasks.get(key);
  if (cached) return cached;
  const canvas = createCanvas(columns, rows);
  const context = canvas.getContext("2d");
  const path = geoPath(fitShape(mode, [0, 0, columns, rows]), context as never);
  context.beginPath();
  path(shapeFor(mode) as never);
  context.fillStyle = "#ffffff";
  context.fill();
  const { data } = context.getImageData(0, 0, columns, rows);
  const mask = Uint8Array.from({ length: columns * rows }, (_, index) =>
    data[index * 4 + 3]! > 100 ? 1 : 0,
  );
  shapeMasks.set(key, mask);
  return mask;
};

const drawNightSky = (context: SKRSContext2D, width: number, height: number, stars: number) => {
  fillGradient(context, width, height, ["#05081a", "#140e3a", "#0a1f3f"]);
  fillGlow(context, width * 0.64, height * 0.2, 200, "#7c3aed44", "#7c3aed00");
  fillGlow(context, width * 0.88, height * 0.95, 200, "#06b6d436", "#06b6d400");
  fillGlow(context, width * 0.5, height * 0.8, 140, "#ec489924", "#ec489900");
  drawStarField(context, width, height, stars, 7, ["#ffffff", "#c7d2fe", "#a5f3fc", "#fde68a"]);
};

const drawShootingStar = (
  context: SKRSContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
) => {
  const tailX = x - Math.cos(angle) * length;
  const tailY = y - Math.sin(angle) * length;
  const tail = context.createLinearGradient(tailX, tailY, x, y);
  tail.addColorStop(0, "#ffffff00");
  tail.addColorStop(1, "#ffffffcc");
  context.strokeStyle = tail;
  context.lineWidth = 1.2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(x, y);
  context.stroke();
  drawFlare(context, x, y, 2, "#ffffff");
};

const drawCrescentMoon = (context: SKRSContext2D, x: number, y: number, radius: number) => {
  fillGlow(context, x, y, radius * 2.4, "#e0e7ff30", "#e0e7ff00");
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  const disk = context.createRadialGradient(x - radius * 0.4, y - radius * 0.4, 1, x, y, radius);
  disk.addColorStop(0, "#f5f3ff");
  disk.addColorStop(1, "#a5b4fc");
  context.fillStyle = disk;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  context.fillStyle = "#6366f133";
  for (const [dx, dy, r] of [
    [-0.35, 0.2, 0.18],
    [-0.1, -0.4, 0.12],
    [-0.5, -0.2, 0.09],
  ] as const) {
    context.beginPath();
    context.arc(x + dx * radius, y + dy * radius, r * radius, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#0b1030ee";
  context.beginPath();
  context.arc(x + radius * 0.45, y - radius * 0.2, radius * 0.92, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const starAtlas: BackgroundPainter = (context, width, height, details) => {
  const mode = details.mode ?? "country";
  drawNightSky(context, width, height, 150);
  // The world (or Türkiye) as a field of stars, echoing the explorer dot map.
  const cell = 3.4;
  const columns = mode === "province" ? 100 : 86;
  const rows = 40;
  // Starts where the name scrim has faded, so the dots stay bright.
  const bounds: Bounds = [width * 0.56, (height - rows * cell) / 2, columns * cell, rows * cell];
  const mask = getShapeMask(mode, columns, rows);
  const random = seededRandom(29);
  const colors = ["#e0e7ff", "#c4b5fd", "#a5f3fc"] as const;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (!mask[row * columns + column]) continue;
      const x = bounds[0] + (column + 0.5) * cell;
      const y = bounds[1] + (row + 0.5) * cell;
      context.globalAlpha = 0.5 + random() * 0.5;
      context.fillStyle = colors[Math.floor(random() * colors.length)]!;
      context.beginPath();
      context.arc(x, y, 0.8 + random() ** 2 * 0.9, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  // The player's top wins become the brightest stars, joined in rank order.
  const projection = fitShape(mode, bounds);
  const points = stampsFor(details)
    .slice(0, PASSPORT_SLOTS.length)
    .flatMap((stamp) => {
      const point = stamp.coordinates && projection(stamp.coordinates);
      return point ? [{ stamp, point }] : [];
    });
  context.save();
  context.shadowColor = "#c4b5fd";
  context.shadowBlur = 6;
  context.strokeStyle = "#e0e7ffaa";
  context.lineWidth = 1;
  context.beginPath();
  points.forEach(({ point: [x, y] }, index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
  context.font = 'bold 9px "DejaVu Sans", Arial, sans-serif';
  context.textBaseline = "middle";
  points.forEach(({ stamp, point: [x, y] }, rank) => {
    drawFlare(context, x, y, 4.4 - rank * 0.45, rank === 0 ? "#fde68a" : "#ffffff");
    context.fillStyle = rank === 0 ? "#fde68a" : "#e0e7ffcc";
    context.fillText(stamp.code, x + 7, y - 8);
  });
  drawCrescentMoon(context, width - 52, height * 0.36, 28);
  drawShootingStar(context, width - 70, height * 0.8, 46, 0.45);
};

/** A short flight log of the top three wins, as glowing pills. */
const drawWinChips = (
  context: SKRSContext2D,
  x: number,
  centerY: number,
  stamps: PassportStamp[],
) => {
  const chips = stamps.slice(0, 3);
  const chipHeight = 22;
  const gap = 8;
  let y = centerY - (chips.length * chipHeight + (chips.length - 1) * gap) / 2;
  context.save();
  context.textBaseline = "middle";
  chips.forEach((stamp, rank) => {
    const color = rank === 0 ? "#fde68a" : "#c4b5fd";
    context.font = 'bold 11px "DejaVu Sans", Arial, sans-serif';
    const codeWidth = context.measureText(stamp.code).width;
    context.font = '10px "DejaVu Sans", Arial, sans-serif';
    const count = `× ${stamp.count}`;
    const chipWidth = 26 + codeWidth + context.measureText(count).width;
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.fillStyle = "#0b103088";
    context.strokeStyle = `${color}aa`;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, chipWidth, chipHeight, chipHeight / 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = color;
    context.font = 'bold 11px "DejaVu Sans", Arial, sans-serif';
    context.fillText(stamp.code, x + 10, y + chipHeight / 2 + 0.5);
    context.fillStyle = "#e0e7ffcc";
    context.font = '10px "DejaVu Sans", Arial, sans-serif';
    context.fillText(count, x + 16 + codeWidth, y + chipHeight / 2 + 0.5);
    y += chipHeight + gap;
  });
  context.restore();
};

const voyagerGlobe: BackgroundPainter = (context, width, height, details) => {
  const mode = details.mode ?? "country";
  drawNightSky(context, width, height, 240);
  const located = stampsFor(details).filter((stamp) => stamp.coordinates);
  const cx = width - 150;
  const cy = height / 2;
  const radius = 62;
  // Country globes turn to face the top win; province globes zoom in on Türkiye.
  const top = located[0]?.coordinates ?? [35, 39];
  const facing: LonLat =
    mode === "province" ? [35.2, 39] : [top[0], Math.max(-30, Math.min(30, top[1]))];
  const projection = geoOrthographic()
    .rotate([-facing[0], -facing[1]])
    .translate([cx, cy])
    .scale(radius * (mode === "province" ? 5 : 1))
    .clipAngle(90);
  const path = geoPath(projection, context as never);
  const orbit = (start: number, end: number, color: string) => {
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.beginPath();
    context.ellipse(cx, cy, 112, 24, -0.28, start, end);
    context.stroke();
  };
  orbit(Math.PI, Math.PI * 2, "#c4b5fd55");
  fillGlow(context, cx, cy, radius * 1.4, "#60a5fa66", "#60a5fa00");
  context.save();
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.clip();
  const ocean = context.createRadialGradient(cx - 22, cy - 25, 6, cx, cy, radius);
  ocean.addColorStop(0, "#2f6fd1");
  ocean.addColorStop(1, "#0a1433");
  context.fillStyle = ocean;
  context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  context.beginPath();
  path(land);
  context.fillStyle = mode === "province" ? "#8fe9ff50" : "#8fe9ffc8";
  context.fill();
  if (mode === "province") {
    context.beginPath();
    path(provinceCollection as never);
    context.fillStyle = "#8fe9ffc8";
    context.fill();
    context.strokeStyle = "#0a1433";
    context.lineWidth = 0.5;
    context.stroke();
  }
  // Golden routes from the top win to the others, then beacons on every visible win.
  context.save();
  context.shadowColor = "#fde68a";
  context.shadowBlur = 5;
  context.strokeStyle = "#fde68acc";
  context.lineWidth = 1.1;
  for (const stamp of located.slice(1, PASSPORT_SLOTS.length)) {
    context.beginPath();
    path({ type: "LineString", coordinates: [top, stamp.coordinates!] } as never);
    context.stroke();
  }
  context.restore();
  located.slice(0, PASSPORT_SLOTS.length).forEach((stamp, rank) => {
    if (geoDistance(stamp.coordinates!, facing) > Math.PI / 2 - 0.05) return;
    const [x, y] = projection(stamp.coordinates!)!;
    const beamHeight = 22 - rank * 2.5;
    const beam = context.createLinearGradient(x, y, x, y - beamHeight);
    beam.addColorStop(0, "#fde68aee");
    beam.addColorStop(1, "#fde68a00");
    context.fillStyle = beam;
    context.fillRect(x - 1, y - beamHeight, 2, beamHeight);
    context.fillStyle = rank === 0 ? "#fff7d6" : "#fde68a";
    context.beginPath();
    context.arc(x, y, rank === 0 ? 3.4 : 2.4, 0, Math.PI * 2);
    context.fill();
    if (rank === 0) {
      context.strokeStyle = "#fde68a99";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.stroke();
    }
  });
  const shade = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  shade.addColorStop(0.5, "#00000000");
  shade.addColorStop(1, "#000000a0");
  context.fillStyle = shade;
  context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  context.restore();
  context.strokeStyle = "#a5f3fc77";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();
  orbit(0, Math.PI, "#e0e7ffaa");
  const moonAngle = 0.6;
  const moonX =
    cx + Math.cos(moonAngle) * 112 * Math.cos(-0.28) - Math.sin(moonAngle) * 24 * Math.sin(-0.28);
  const moonY =
    cy + Math.cos(moonAngle) * 112 * Math.sin(-0.28) + Math.sin(moonAngle) * 24 * Math.cos(-0.28);
  fillGlow(context, moonX, moonY, 10, "#fde68aaa", "#fde68a00");
  context.fillStyle = "#fef3c7";
  context.beginPath();
  context.arc(moonX, moonY, 3.6, 0, Math.PI * 2);
  context.fill();
  drawWinChips(context, width * 0.6, height / 2, located);
  drawShootingStar(context, width * 0.76, height * 0.24, 50, 0.35);
  drawFlare(context, width * 0.56, height * 0.18, 2.8, "#e0e7ff");
  drawFlare(context, width * 0.76, height * 0.82, 2.2, "#a5f3fc");
  drawFlare(context, width - 24, height * 0.15, 3, "#ffffff");
};

const drawWaxSeal = (context: SKRSContext2D, x: number, y: number, radius: number) => {
  context.save();
  context.fillStyle = "#7f1d1d";
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(x + side * 4, y);
    context.lineTo(x + side * 14, y + radius + 22);
    context.lineTo(x + side * 8, y + radius + 17);
    context.lineTo(x + side * 3, y + radius + 23);
    context.closePath();
    context.fill();
  }
  context.shadowColor = "#00000099";
  context.shadowBlur = 6;
  const wax = context.createRadialGradient(x - 6, y - 6, 2, x, y, radius);
  wax.addColorStop(0, "#ef4444");
  wax.addColorStop(1, "#7f1d1d");
  context.fillStyle = wax;
  context.beginPath();
  for (let step = 0; step <= 40; step++) {
    const angle = (step / 40) * Math.PI * 2;
    const r = radius * (1 + 0.06 * Math.sin(step * 2.7) + 0.04 * Math.sin(step * 5.3));
    if (step === 0) context.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    else context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#fca5a566";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, radius * 0.66, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#fecaca99";
  context.beginPath();
  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const r = index % 2 === 0 ? radius * 0.45 : radius * 0.19;
    if (index === 0) context.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    else context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  context.closePath();
  context.fill();
  context.restore();
};

const gildedPassport: BackgroundPainter = (context, width, height, details) => {
  fillGradient(context, width, height, ["#0e0a1f", "#1a1035", "#0f1a30"]);
  // Fine grain gives the cover a leather feel.
  const random = seededRandom(3);
  context.fillStyle = "#ffffff";
  for (let index = 0; index < 1800; index++) {
    context.globalAlpha = 0.015 + random() * 0.035;
    context.fillRect(random() * width, random() * height, 1, 1);
  }
  context.globalAlpha = 1;
  // Banknote-style guilloché lines run under the stamps.
  context.lineWidth = 0.6;
  for (let line = 0; line < 14; line++) {
    context.strokeStyle = line % 4 === 0 ? "#f5c54226" : "#f5c54214";
    context.beginPath();
    for (let x = width * 0.4; x <= width; x += 3) {
      const envelope = Math.sin(((x - width * 0.4) / (width * 0.6)) * Math.PI);
      const y = height / 2 + Math.sin(x * 0.018 + line * 0.45) * (12 + line * 3.4) * envelope;
      if (x === width * 0.4) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  fillGlow(context, width * 0.8, height / 2, 230, "#f5c54220", "#f5c54200");
  drawStampSet(context, width, height, stampsFor(details), (_, alpha) => ({
    color: `#f5c542${alpha}`,
    glow: "#f5c54266",
  }));
  drawGoldFrame(context, width, height);
  drawWaxSeal(context, width - 36, 34, 19);
  drawFlare(context, width * 0.66, height * 0.16, 2.6, "#fff4c2");
  drawFlare(context, width * 0.9, height * 0.88, 2.2, "#fff4c2");
  drawFlare(context, width * 0.55, height * 0.5, 1.8, "#fff4c2");
};

const STAMP_GLOWS = ["#c4b5fd", "#a5f3fc", "#f9a8d4"] as const;

const celestialStamps: BackgroundPainter = (context, width, height, details) => {
  drawNightSky(context, width, height, 220);
  drawStampSet(context, width, height, stampsFor(details), (rank, alpha) => {
    const color = STAMP_GLOWS[rank % STAMP_GLOWS.length]!;
    return { color: `${color}${alpha}`, glow: `${color}cc` };
  });
  drawShootingStar(context, width * 0.68, height * 0.86, 50, -0.4);
  drawFlare(context, width * 0.92, height * 0.14, 3, "#ffffff");
  drawFlare(context, width * 0.58, height * 0.12, 2.4, "#e0e7ff");
};

// Star Atlas refinements: a larger dot map without Antarctica, richer skies and new bright stars.
type DotMap = {
  mask: Uint8Array;
  columns: number;
  rows: number;
  dot: (column: number, row: number) => [number, number];
  project: (coordinates: LonLat) => [number, number] | undefined;
};

/** Inhabited latitudes only: Antarctica and the far Arctic fall outside the map. */
const WORLD_CROP = {
  type: "MultiPoint",
  coordinates: [
    ...Array.from({ length: 37 }, (_, index) => [-180 + index * 10, 75]),
    ...Array.from({ length: 37 }, (_, index) => [-180 + index * 10, -56]),
  ],
};

const dotMaps = new Map<string, DotMap>();
/** A dot grid over `bounds`, stretched up to `maxStretch` sideways to use a wide, short header. */
const createDotMap = (
  mode: GameMode,
  [left, top, width, height]: Bounds,
  cell: number,
  maxStretch: number,
): DotMap => {
  const key = [mode, left, top, width, height, cell, maxStretch].join(":");
  const cached = dotMaps.get(key);
  if (cached) return cached;
  const fitTarget = mode === "province" ? provinceCollection : WORLD_CROP;
  const projection = (mode === "province" ? geoMercator() : geoNaturalEarth1()).fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    fitTarget as never,
  );
  const [[x0], [x1]] = geoPath(projection).bounds(fitTarget as never);
  const stretch = Math.min(maxStretch, width / (x1 - x0));
  const offset = (width - (x1 - x0) * stretch) / 2 - x0 * stretch;
  const columns = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  const canvas = createCanvas(columns, rows);
  const context = canvas.getContext("2d");
  context.scale(columns / width, rows / height);
  context.translate(offset, 0);
  context.scale(stretch, 1);
  context.beginPath();
  geoPath(projection, context as never)(shapeFor(mode) as never);
  context.fillStyle = "#ffffff";
  context.fill();
  const { data } = context.getImageData(0, 0, columns, rows);
  const dotMap: DotMap = {
    mask: Uint8Array.from({ length: columns * rows }, (_, index) =>
      data[index * 4 + 3]! > 100 ? 1 : 0,
    ),
    columns,
    rows,
    dot: (column, row) => [
      left + ((column + 0.5) * width) / columns,
      top + ((row + 0.5) * height) / rows,
    ],
    project: (coordinates) => {
      const point = projection(coordinates);
      return point ? [left + offset + point[0] * stretch, top + point[1]] : undefined;
    },
  };
  dotMaps.set(key, dotMap);
  return dotMap;
};

const drawDotMap = (
  context: SKRSContext2D,
  dotMap: DotMap,
  seed: number,
  colors: readonly string[],
  radius: [min: number, max: number],
) => {
  const random = seededRandom(seed);
  context.save();
  for (let row = 0; row < dotMap.rows; row++) {
    for (let column = 0; column < dotMap.columns; column++) {
      if (!dotMap.mask[row * dotMap.columns + column]) continue;
      const [x, y] = dotMap.dot(column, row);
      context.globalAlpha = 0.45 + random() * 0.55;
      context.fillStyle = colors[Math.floor(random() * colors.length)]!;
      context.beginPath();
      context.arc(x, y, radius[0] + random() ** 2 * (radius[1] - radius[0]), 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
};

type PlacedWin = { stamp: PassportStamp; x: number; y: number; rank: number };

const placeWins = (dotMap: DotMap, details: HeaderDetails): PlacedWin[] =>
  stampsFor(details)
    .slice(0, PASSPORT_SLOTS.length)
    .flatMap((stamp, rank) => {
      const point = stamp.coordinates && dotMap.project(stamp.coordinates);
      return point ? [{ stamp, x: point[0], y: point[1], rank }] : [];
    });

/** "TR × 31" pills beside each bright star, nudged so neighbours never overlap. */
const drawWinLabels = (
  context: SKRSContext2D,
  wins: PlacedWin[],
  colorFor: (rank: number) => string,
  bounds: { width: number; height: number },
  gap = 9,
) => {
  const placed: Array<[number, number, number, number]> = [];
  context.save();
  context.textBaseline = "middle";
  for (const win of wins) {
    const label = `${win.stamp.code} × ${win.stamp.count}`;
    context.font = 'bold 9px "DejaVu Sans", Arial, sans-serif';
    const labelWidth = context.measureText(label).width + 12;
    const labelHeight = 15;
    const candidates: Array<[number, number]> = [
      [win.x + gap, win.y - gap - labelHeight],
      [win.x + gap, win.y + gap],
      [win.x - gap - labelWidth, win.y - gap - labelHeight],
      [win.x - gap - labelWidth, win.y + gap],
    ];
    const fits = ([x, y]: [number, number]) =>
      x >= 2 &&
      y >= 2 &&
      x + labelWidth <= bounds.width - 2 &&
      y + labelHeight <= bounds.height - 2 &&
      placed.every(
        ([px, py, pw, ph]) =>
          x + labelWidth < px || px + pw < x || y + labelHeight < py || py + ph < y,
      );
    const [x, y] = candidates.find(fits) ?? candidates[0]!;
    placed.push([x, y, labelWidth, labelHeight]);
    const color = colorFor(win.rank);
    context.strokeStyle = `${color}88`;
    context.lineWidth = 0.7;
    context.beginPath();
    context.moveTo(win.x, win.y);
    context.lineTo(x < win.x ? x + labelWidth : x, y + labelHeight / 2);
    context.stroke();
    context.fillStyle = "#070b1ccc";
    context.beginPath();
    context.roundRect(x, y, labelWidth, labelHeight, labelHeight / 2);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.fillText(label, x + 6, y + labelHeight / 2 + 0.5);
  }
  context.restore();
};

const drawConstellation = (context: SKRSContext2D, wins: PlacedWin[], color: string) => {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 6;
  context.strokeStyle = `${color}99`;
  context.lineWidth = 1;
  context.setLineDash([2, 3]);
  context.beginPath();
  wins.forEach(({ x, y }, index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
};

/** Eight-point star with a halo ring. */
const drawNova = (context: SKRSContext2D, x: number, y: number, size: number, color: string) => {
  fillGlow(context, x, y, size * 6, `${color}50`, `${color}00`);
  context.strokeStyle = `${color}90`;
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(x, y, size * 2.3, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = color;
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const length = index % 2 ? size * 2.6 : size * 4.6;
    const half = size * 0.2;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.beginPath();
    context.moveTo(0, -length);
    context.lineTo(half, 0);
    context.lineTo(0, length);
    context.lineTo(-half, 0);
    context.closePath();
    context.fill();
    context.restore();
  }
  fillGlow(context, x, y, size * 1.6, "#ffffffff", "#ffffff00");
};

/** A four-point star inside a ticked sighting ring, like an astrolabe marker. */
const drawReticleStar = (
  context: SKRSContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  fillGlow(context, x, y, size * 4.5, `${color}40`, `${color}00`);
  context.strokeStyle = `${color}cc`;
  context.lineWidth = 0.9;
  context.beginPath();
  context.arc(x, y, size * 2.6, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI) / 6;
    const inner = size * (index % 3 === 0 ? 2.6 : 2.9);
    context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
    context.lineTo(x + Math.cos(angle) * size * 3.4, y + Math.sin(angle) * size * 3.4);
  }
  context.stroke();
  drawFlare(context, x, y, size * 1.5, color);
  fillGlow(context, x, y, size, "#fffbeb", "#fffbeb00");
};

/** A pillar of light rising from the win, with ground rings. */
const drawBeacon = (context: SKRSContext2D, x: number, y: number, size: number, color: string) => {
  const pillar = context.createLinearGradient(x, y, x, 0);
  pillar.addColorStop(0, `${color}ee`);
  pillar.addColorStop(1, `${color}00`);
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.fillStyle = pillar;
  context.fillRect(x - size * 0.45, 0, size * 0.9, y);
  context.restore();
  context.strokeStyle = `${color}aa`;
  context.lineWidth = 0.9;
  for (const ring of [1.6, 2.8]) {
    context.beginPath();
    context.ellipse(x, y, size * ring * 1.6, size * ring * 0.55, 0, 0, Math.PI * 2);
    context.stroke();
  }
  fillGlow(context, x, y, size * 2.2, "#ffffffee", "#ffffff00");
};

/** Soft overlapping clouds; `screen` blending lets colors build up like gas. */
const drawNebula = (
  context: SKRSContext2D,
  width: number,
  height: number,
  seed: number,
  colors: readonly string[],
  count: number,
) => {
  const random = seededRandom(seed);
  context.save();
  context.globalCompositeOperation = "screen";
  for (let index = 0; index < count; index++) {
    const x = width * (0.3 + random() * 0.72);
    const y = height * (random() * 1.2 - 0.1);
    const radius = 30 + random() * 120;
    const color = colors[index % colors.length]!;
    const alpha = Math.round(0x14 + random() * 0x22)
      .toString(16)
      .padStart(2, "0");
    fillGlow(context, x, y, radius, `${color}${alpha}`, `${color}00`);
  }
  context.restore();
};

const drawMilkyWay = (
  context: SKRSContext2D,
  width: number,
  height: number,
  seed: number,
  angle: number,
) => {
  const random = seededRandom(seed);
  context.save();
  context.translate(width * 0.68, height / 2);
  context.rotate(angle);
  const band = context.createLinearGradient(0, -48, 0, 48);
  band.addColorStop(0, "#c7d2fe00");
  band.addColorStop(0.5, "#c7d2fe1c");
  band.addColorStop(1, "#c7d2fe00");
  context.fillStyle = band;
  context.fillRect(-width, -48, width * 2, 96);
  context.fillStyle = "#e0e7ff";
  for (let index = 0; index < 1100; index++) {
    // Summing randoms clusters the stars toward the band's centre line.
    const offset = (random() + random() + random() - 1.5) * 34;
    context.globalAlpha = 0.15 + random() * 0.5;
    context.fillRect((random() - 0.5) * width * 1.4, offset, 0.9, 0.9);
  }
  context.restore();
};

/** A stylized world tolerates being widened to fill the short header; Türkiye's outline does not. */
const STAR_ATLAS_STRETCH: Record<GameMode, number> = { country: 1.7, province: 1.15 };

const STAR_ATLAS_BOUNDS = (width: number, height: number): Bounds => [
  width * 0.5,
  5,
  width * 0.49,
  height - 10,
];

const starAtlasNebula: BackgroundPainter = (context, width, height, details) => {
  const mode = details.mode ?? "country";
  fillGradient(context, width, height, ["#04061a", "#120b33", "#081a36"]);
  drawNebula(
    context,
    width,
    height,
    31,
    ["#7c3aed", "#db2777", "#0891b2", "#4f46e5", "#0d9488"],
    30,
  );
  // Dark dust lanes break up the glow.
  const dust = seededRandom(37);
  for (let index = 0; index < 7; index++) {
    fillGlow(
      context,
      width * (0.45 + dust() * 0.55),
      height * dust(),
      30 + dust() * 60,
      "#02030a66",
      "#02030a00",
    );
  }
  drawMilkyWay(context, width, height, 41, -0.22);
  drawStarField(context, width, height, 220, 43, ["#ffffff", "#c7d2fe", "#a5f3fc", "#fbcfe8"]);
  const dotMap = createDotMap(
    mode,
    STAR_ATLAS_BOUNDS(width, height),
    3.2,
    STAR_ATLAS_STRETCH[mode],
  );
  drawDotMap(context, dotMap, 29, ["#e0e7ff", "#c4b5fd", "#a5f3fc"], [0.7, 1.5]);
  const wins = placeWins(dotMap, details);
  drawConstellation(context, wins, "#e0e7ff");
  const colorFor = (rank: number) => (rank === 0 ? "#fde68a" : "#e0e7ff");
  for (const win of wins.toReversed()) {
    drawNova(context, win.x, win.y, 2.6 - win.rank * 0.25, colorFor(win.rank));
  }
  drawWinLabels(context, wins, colorFor, { width, height });
};

const drawSkyChart = (context: SKRSContext2D, width: number, height: number) => {
  // Declination arcs and hour lines from a pole far below the header.
  const poleX = width * 0.74;
  const poleY = height + 420;
  context.strokeStyle = "#93c5fd1a";
  context.lineWidth = 0.7;
  for (let radius = 400; radius < 640; radius += 26) {
    context.beginPath();
    context.arc(poleX, poleY, radius, Math.PI * 1.05, Math.PI * 1.95);
    context.stroke();
  }
  context.beginPath();
  for (let index = -12; index <= 12; index++) {
    const angle = -Math.PI / 2 + index * 0.06;
    context.moveTo(poleX + Math.cos(angle) * 400, poleY + Math.sin(angle) * 400);
    context.lineTo(poleX + Math.cos(angle) * 700, poleY + Math.sin(angle) * 700);
  }
  context.stroke();
  // The ecliptic, with degree marks.
  const ecliptic = (x: number) =>
    height * 0.55 + Math.sin((x / width) * Math.PI * 1.6 + 0.6) * height * 0.3;
  context.strokeStyle = "#f5c54240";
  context.setLineDash([6, 4]);
  context.beginPath();
  for (let x = 0; x <= width; x += 4) {
    if (x === 0) context.moveTo(x, ecliptic(x));
    else context.lineTo(x, ecliptic(x));
  }
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#f5c54259";
  context.font = '7px "DejaVu Sans", Arial, sans-serif';
  context.textAlign = "center";
  for (let index = 0; index * 70 < width; index++) {
    const x = index * 70 + 35;
    context.fillRect(x - 0.5, ecliptic(x) - 4, 1, 8);
    context.fillText(`${(index * 30) % 360}°`, x, ecliptic(x) - 8);
  }
  // Ruler ticks along the top and bottom edges, as on a printed chart.
  context.fillStyle = "#93c5fd55";
  for (let x = 0; x < width; x += 10) {
    const long = x % 50 === 0;
    context.fillRect(x, 0, 0.8, long ? 6 : 3);
    context.fillRect(x, height - (long ? 6 : 3), 0.8, long ? 6 : 3);
  }
  context.fillStyle = "#93c5fd66";
  context.textAlign = "left";
  for (let hour = 0; hour * 100 < width; hour++) {
    context.fillText(`${hour}h`, hour * 100 + 3, 13);
  }
  // A few unrelated faint constellations fill the sky behind the name.
  const random = seededRandom(53);
  for (let group = 0; group < 5; group++) {
    const cx = width * (0.08 + group * 0.11);
    const cy = height * (0.2 + random() * 0.6);
    const points = Array.from({ length: 4 + Math.floor(random() * 3) }, () => [
      cx + (random() - 0.5) * 90,
      cy + (random() - 0.5) * 70,
    ]);
    context.strokeStyle = "#c7d2fe24";
    context.lineWidth = 0.7;
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x!, y!);
      else context.lineTo(x!, y!);
    });
    context.stroke();
    context.fillStyle = "#e0e7ff88";
    for (const [x, y] of points) {
      context.beginPath();
      context.arc(x!, y!, 1.3, 0, Math.PI * 2);
      context.fill();
    }
  }
};

const starAtlasObservatory: BackgroundPainter = (context, width, height, details) => {
  const mode = details.mode ?? "country";
  fillGradient(context, width, height, ["#060b1f", "#0b1736", "#0a1229"]);
  drawNebula(context, width, height, 59, ["#1d4ed8", "#7c3aed", "#0e7490"], 14);
  drawMilkyWay(context, width, height, 61, 0.18);
  drawStarField(context, width, height, 200, 67, ["#ffffff", "#bfdbfe", "#fde68a"]);
  drawSkyChart(context, width, height);
  const dotMap = createDotMap(
    mode,
    STAR_ATLAS_BOUNDS(width, height),
    3.2,
    STAR_ATLAS_STRETCH[mode],
  );
  drawDotMap(context, dotMap, 71, ["#dbeafe", "#bfdbfe", "#93c5fd"], [0.7, 1.4]);
  const wins = placeWins(dotMap, details);
  drawConstellation(context, wins, "#f5c542");
  const colorFor = (rank: number) => (rank === 0 ? "#fde68a" : "#f5c542");
  for (const win of wins.toReversed()) {
    drawReticleStar(context, win.x, win.y, 2.6 - win.rank * 0.25, colorFor(win.rank));
  }
  drawWinLabels(context, wins, colorFor, { width, height }, 11);
};

const drawAurora = (context: SKRSContext2D, width: number, height: number) => {
  context.save();
  context.globalCompositeOperation = "screen";
  for (const [color, phase, base, length] of [
    ["#34d399", 0.2, 0.18, 0.75],
    ["#22d3ee", 1.7, 0.08, 0.6],
    ["#a78bfa", 3.1, 0.3, 0.55],
    ["#34d399", 4.4, 0.02, 0.45],
  ] as const) {
    for (let x = width * 0.3; x <= width; x += 2) {
      const t = x / width;
      const y =
        height * (base + 0.12 * Math.sin(t * 9 + phase) + 0.06 * Math.sin(t * 23 + phase * 2));
      const curtain = height * length * (0.6 + 0.4 * Math.sin(t * 13 + phase) ** 2);
      const fade = Math.min(1, (x - width * 0.3) / (width * 0.2));
      const ray = context.createLinearGradient(x, y, x, y + curtain);
      ray.addColorStop(0, `${color}00`);
      ray.addColorStop(
        0.15,
        `${color}${Math.round(0x40 * fade)
          .toString(16)
          .padStart(2, "0")}`,
      );
      ray.addColorStop(1, `${color}00`);
      context.fillStyle = ray;
      context.fillRect(x, y, 2, curtain);
    }
  }
  context.restore();
};

const starAtlasAurora: BackgroundPainter = (context, width, height, details) => {
  const mode = details.mode ?? "country";
  fillGradient(context, width, height, ["#030a14", "#071a2a", "#0b1530"]);
  drawStarField(context, width, height, 260, 73, ["#ffffff", "#d1fae5", "#c7d2fe"]);
  drawAurora(context, width, height);
  drawNebula(context, width, height, 79, ["#0f766e", "#6d28d9"], 10);
  const dotMap = createDotMap(
    mode,
    STAR_ATLAS_BOUNDS(width, height),
    3.2,
    STAR_ATLAS_STRETCH[mode],
  );
  drawDotMap(context, dotMap, 83, ["#ecfdf5", "#a7f3d0", "#a5f3fc"], [0.7, 1.5]);
  const wins = placeWins(dotMap, details);
  const colorFor = (rank: number) => (rank === 0 ? "#fde68a" : "#a7f3d0");
  for (const win of wins.toReversed()) {
    drawBeacon(context, win.x, win.y, 2.8 - win.rank * 0.25, colorFor(win.rank));
  }
  drawWinLabels(context, wins, colorFor, { width, height });
};

type HeaderDesignTier = "explorer" | "legend";

type HeaderDesignSpec = {
  name: string;
  /** The lowest name tier that may use this background. */
  tier?: HeaderDesignTier;
  draw: BackgroundPainter;
  /** Replaces the tier's name style while this background is active. */
  nameStyle?: PlayerNameStyle;
  /** Where the dark fade behind the name ends, as a fraction of the width. */
  scrimEnd?: number;
};

/** Keep every option here; selecting an active design never removes the alternatives. */
const designs = {
  plain: { name: "Plain", draw: () => {} },
  atlas: { name: "Atlas", tier: "explorer", draw: atlas },
  nautical: { name: "Nautical", tier: "explorer", draw: nautical },
  aurora: { name: "Aurora", tier: "explorer", draw: aurora },
  pixelAtlas: { name: "Pixel Atlas", tier: "explorer", draw: pixelAtlas },
  pixelVoyager: { name: "Pixel Voyager", tier: "explorer", draw: pixelVoyager },
  atlasGlobe: { name: "Atlas Globe", tier: "explorer", draw: atlasGlobe },
  atlasDots: { name: "Atlas Dots", tier: "explorer", draw: atlasDots },
  atlasRoutes: { name: "Atlas Routes", tier: "explorer", draw: atlasRoutes },
  atlasTopo: { name: "Atlas Topo", tier: "explorer", draw: atlasTopo },
  passport: { name: "Passport", tier: "explorer", draw: passport },
  ridges: { name: "Ridges", tier: "explorer", draw: ridges },
  sonar: { name: "Sonar", tier: "explorer", draw: sonar },
  seaChart: { name: "Sea Chart", tier: "explorer", draw: seaChart },
  celestial: {
    name: "Celestial",
    tier: "legend",
    draw: celestial,
    nameStyle: LEGEND_NAME_STYLES.celestial,
  },
  royal: { name: "Royal Crest", tier: "legend", draw: royal, nameStyle: LEGEND_NAME_STYLES.royal },
  prismatic: {
    name: "Prismatic",
    tier: "legend",
    draw: prismatic,
    nameStyle: LEGEND_NAME_STYLES.prismatic,
  },
  eclipse: {
    name: "Eclipse",
    tier: "legend",
    draw: eclipse,
    nameStyle: LEGEND_NAME_STYLES.eclipse,
  },
  starAtlas: {
    name: "Star Atlas",
    tier: "legend",
    draw: starAtlas,
    nameStyle: LEGEND_NAME_STYLES.celestial,
  },
  voyagerGlobe: {
    name: "Voyager Globe",
    tier: "legend",
    draw: voyagerGlobe,
    nameStyle: LEGEND_NAME_STYLES.celestial,
  },
  gildedPassport: {
    name: "Gilded Passport",
    tier: "legend",
    draw: gildedPassport,
    nameStyle: LEGEND_NAME_STYLES.royal,
  },
  starAtlasNebula: {
    name: "Star Atlas · Nebula",
    tier: "legend",
    draw: starAtlasNebula,
    nameStyle: LEGEND_NAME_STYLES.celestial,
    scrimEnd: 0.52,
  },
  starAtlasObservatory: {
    name: "Star Atlas · Observatory",
    tier: "legend",
    draw: starAtlasObservatory,
    nameStyle: LEGEND_NAME_STYLES.borealis,
    scrimEnd: 0.52,
  },
  starAtlasAurora: {
    name: "Star Atlas · Aurora",
    tier: "legend",
    draw: starAtlasAurora,
    nameStyle: LEGEND_NAME_STYLES.celestial,
    scrimEnd: 0.52,
  },
  celestialStamps: {
    name: "Celestial Stamps",
    tier: "legend",
    draw: celestialStamps,
    nameStyle: LEGEND_NAME_STYLES.celestial,
  },
} satisfies Record<string, HeaderDesignSpec>;

export type PlayerMapHeaderDesign = keyof typeof designs;

export const PLAYER_MAP_HEADER_DESIGNS: Record<PlayerMapHeaderDesign, HeaderDesignSpec> = designs;

/** Select the background for each decorated tier; all alternatives stay in the registry above. */
export const activePlayerMapHeaderDesigns: Record<HeaderDesignTier, PlayerMapHeaderDesign> = {
  explorer: "passport",
  legend: "starAtlasObservatory",
};

/** Explorer (200+) and legend (500+) players get a background; `requested` overrides it for previews. */
export const getPlayerMapHeaderDesign = (
  medals: MapMedalCounts,
  requested?: PlayerMapHeaderDesign,
): PlayerMapHeaderDesign => {
  const tier = getPlayerNameTier(medals);
  if (tier !== "explorer" && tier !== "legend") return "plain";
  const requestedTier = requested ? PLAYER_MAP_HEADER_DESIGNS[requested].tier : undefined;
  // Explorers cannot use legend backgrounds, even in previews.
  if (requested && (tier === "legend" || requestedTier !== "legend")) {
    return requested;
  }
  return activePlayerMapHeaderDesigns[tier];
};

export const getPlayerMapNameStyle = (medals: MapMedalCounts, design: PlayerMapHeaderDesign) =>
  PLAYER_MAP_HEADER_DESIGNS[design].nameStyle ?? getPlayerNameStyle(medals);

export const drawPlayerMapHeaderBackground = (
  context: SKRSContext2D,
  design: PlayerMapHeaderDesign,
  width: number,
  height: number,
  details: HeaderDetails = {},
) => {
  if (design === "plain") return;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  const ui = MAP_RESOLUTION_SCALE;
  context.scale(ui, ui);
  PLAYER_MAP_HEADER_DESIGNS[design].draw(context, width / ui, height / ui, details);
  // A translucent fade protects even long names while retaining the full-width design.
  const scrim = context.createLinearGradient(0, 0, width / ui, 0);
  // Designs with a busy right half end the fade sooner but keep the name area dark.
  const scrimEnd = PLAYER_MAP_HEADER_DESIGNS[design].scrimEnd ?? 0.74;
  scrim.addColorStop(0, "#080f2488");
  scrim.addColorStop(scrimEnd * 0.57, "#080f2477");
  scrim.addColorStop(scrimEnd, "#080f2400");
  context.fillStyle = scrim;
  context.fillRect(0, 0, width / ui, height / ui);
  context.restore();
};
