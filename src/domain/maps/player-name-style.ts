import type { SKRSContext2D } from "@napi-rs/canvas";
import type { MapMedalCounts } from "./map-header.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

export const PLAYER_NAME_STYLES = {
  white: {
    color: "#f1f5f9",
    highlight: "#f1f5f9",
    shade: "#f1f5f9",
    glow: "#00000000",
    sparkles: 0,
  },
  gold: {
    color: "#f2c94c",
    highlight: "#fff1b8",
    shade: "#e4a62e",
    glow: "#f2c94c40",
    sparkles: 1,
  },
  rose: {
    color: "#e06ca8",
    highlight: "#ffd1e8",
    shade: "#b65dbd",
    glow: "#e06ca850",
    sparkles: 2,
  },
  platinum: {
    color: "#b8d8ff",
    highlight: "#f1f7ff",
    shade: "#79aefe",
    glow: "#93c5fd66",
    sparkles: 3,
  },
  explorer: {
    color: "#91f2d1",
    highlight: "#e3fff6",
    shade: "#65d4ee",
    glow: "#6ee7d966",
    sparkles: 4,
  },
} as const;

export type PlayerNameTier = keyof typeof PLAYER_NAME_STYLES;
export type PlayerNameStyle = (typeof PLAYER_NAME_STYLES)[PlayerNameTier];

/** Thresholds use medal counts, not medal points, within the selected game mode. */
export const getPlayerNameTier = (medals: MapMedalCounts): PlayerNameTier => {
  const total = medals.gold + medals.silver + medals.bronze;
  if (total >= 400) return "explorer";
  if (total >= 300) return "platinum";
  if (total >= 150) return "rose";
  if (total >= 25) return "gold";
  return "white";
};

export const getPlayerNameStyle = (medals: MapMedalCounts): PlayerNameStyle =>
  PLAYER_NAME_STYLES[getPlayerNameTier(medals)];

export const playerNameDecorationWidth = (style: PlayerNameStyle) =>
  style.sparkles === 0 ? 0 : (12 + 14 * style.sparkles) * MAP_RESOLUTION_SCALE;

/** Metallic lettering and small sparkles preserve the normal name line's size. */
export const drawStyledPlayerName = (
  context: SKRSContext2D,
  name: string,
  x: number,
  baseline: number,
  style: PlayerNameStyle,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  context.save();
  if (style.sparkles === 0) {
    context.fillStyle = style.color;
  } else {
    const gradient = context.createLinearGradient(0, baseline - 32 * ui, 0, baseline);
    gradient.addColorStop(0, style.highlight);
    gradient.addColorStop(0.45, style.color);
    gradient.addColorStop(1, style.shade);
    context.fillStyle = gradient;
    context.shadowColor = style.glow;
    context.shadowBlur = (2 + style.sparkles) * ui;
  }
  context.fillText(name, x, baseline);

  const nameEnd = x + context.measureText(name).width;
  context.fillStyle = style.highlight;
  for (let index = 0; index < style.sparkles; index++) {
    const cx = nameEnd + (10 + index * 14) * ui;
    const cy = baseline - (index % 2 === 0 ? 16 : 22) * ui;
    const radius = (4 + style.sparkles - index) * ui;
    const inset = radius * 0.22;
    context.globalAlpha = 1 - index * 0.12;
    context.beginPath();
    context.moveTo(cx, cy - radius);
    context.lineTo(cx + inset, cy - inset);
    context.lineTo(cx + radius, cy);
    context.lineTo(cx + inset, cy + inset);
    context.lineTo(cx, cy + radius);
    context.lineTo(cx - inset, cy + inset);
    context.lineTo(cx - radius, cy);
    context.lineTo(cx - inset, cy - inset);
    context.closePath();
    context.fill();
  }
  context.restore();
};
