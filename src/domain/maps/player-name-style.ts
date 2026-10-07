import type { SKRSContext2D } from "@napi-rs/canvas";
import { MEDAL_POINTS } from "../awards/periods.ts";
import type { MapMedalCounts } from "./map-header.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

export type PlayerNameTier = "white" | "gold" | "rose" | "platinum" | "explorer" | "legend";

export type PlayerNameEmblem = {
  shape: "crown" | "star" | "gem";
  fill: string;
  shine: string;
};

export type PlayerNameStyle = {
  color: string;
  highlight: string;
  shade: string;
  glow: string;
  sparkles: number;
  glowBlur?: number;
  /** Colors run across the name (left to right unless `sheenDirection` says otherwise). */
  sheen?: readonly string[];
  /** `vertical` gives banded metal; `diagonal` runs from the top left to the bottom right. */
  sheenDirection?: "horizontal" | "vertical" | "diagonal";
  /** A soft top highlight over the sheen. On by default. */
  gloss?: boolean;
  outline?: string;
  /** A colored ring between the dark outline and the letters, as a gradient. */
  rim?: readonly string[];
  /** A bright diagonal streak across the name. */
  shimmer?: string;
  /** Small four-point glints on the letters. */
  glints?: number;
  /** A darker copy below the name gives raised lettering. */
  extrude?: string;
  emblem?: PlayerNameEmblem;
};

/** Each legend header design selects one of these; keep every option for later changes. */
export const LEGEND_NAME_STYLES = {
  celestial: {
    color: "#e0e7ff",
    highlight: "#ffffff",
    shade: "#a78bfa",
    glow: "#a78bfacc",
    glowBlur: 12,
    sparkles: 4,
    sheen: ["#ffffff", "#c4b5fd", "#93c5fd", "#a5f3fc", "#ffffff"],
    outline: "#1e1b4b",
    emblem: { shape: "star", fill: "#c4b5fd", shine: "#ffffff" },
  },
  royal: {
    color: "#f5c542",
    highlight: "#fff4c2",
    shade: "#b7791f",
    glow: "#f5c54288",
    glowBlur: 10,
    sparkles: 3,
    sheen: ["#fff4c2", "#f5c542", "#c8891e", "#ffe9a0", "#e0a32e"],
    outline: "#2a0710",
    extrude: "#4a1206",
    emblem: { shape: "crown", fill: "#f5c542", shine: "#fff4c2" },
  },
  prismatic: {
    color: "#ffffff",
    highlight: "#ffffff",
    shade: "#c9a2ff",
    glow: "#ffffff66",
    glowBlur: 10,
    sparkles: 4,
    sheen: ["#ff9ad5", "#ffd27a", "#9bffb0", "#8fd8ff", "#c9a2ff", "#ff9ad5"],
    outline: "#1b1033",
    emblem: { shape: "gem", fill: "#a5f3fc", shine: "#ffffff" },
  },
  eclipse: {
    color: "#ffd98a",
    highlight: "#fffaf0",
    shade: "#ff9f1a",
    glow: "#ffb34799",
    glowBlur: 14,
    sparkles: 4,
    sheen: ["#fffaf0", "#ffd98a", "#ffb347", "#fff3d6", "#ffd98a"],
    outline: "#1a0f02",
    extrude: "#3a2104",
    emblem: { shape: "star", fill: "#ffd98a", shine: "#fffaf0" },
  },
  // Second round of options; every one is kept so the active style can change later.
  starlightGold: {
    color: "#f5c542",
    highlight: "#fffbea",
    shade: "#a86b12",
    glow: "#f5c54299",
    glowBlur: 12,
    sparkles: 4,
    sheen: ["#fffbea", "#ffe08a", "#f5c542", "#a86b12", "#ffd36b", "#fff3c4"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#0b1230",
    rim: ["#fff3c4", "#c8891e", "#fff3c4"],
    shimmer: "#ffffff",
    glints: 3,
    emblem: { shape: "star", fill: "#f5c542", shine: "#fffbea" },
  },
  sunsetEmber: {
    color: "#fb923c",
    highlight: "#fff7ed",
    shade: "#c026d3",
    glow: "#f43f5e99",
    glowBlur: 14,
    sparkles: 4,
    sheen: ["#fde68a", "#fb923c", "#f43f5e", "#c026d3"],
    outline: "#2a0a1f",
    rim: ["#fde68a", "#f43f5e"],
    shimmer: "#fff7ed",
    emblem: { shape: "star", fill: "#fb923c", shine: "#fde68a" },
  },
  borealis: {
    color: "#34d399",
    highlight: "#ecfdf5",
    shade: "#818cf8",
    glow: "#22d3ee99",
    glowBlur: 14,
    sparkles: 4,
    sheen: ["#a7f3d0", "#34d399", "#22d3ee", "#818cf8", "#c084fc"],
    outline: "#04121f",
    rim: ["#ecfdf5", "#22d3ee", "#c084fc"],
    glints: 2,
    emblem: { shape: "gem", fill: "#5eead4", shine: "#ecfdf5" },
  },
  roseGold: {
    color: "#e8a1a1",
    highlight: "#fff1f2",
    shade: "#9f5a63",
    glow: "#fda4af88",
    glowBlur: 10,
    sparkles: 3,
    sheen: ["#fff1f2", "#f9c6c0", "#e8a1a1", "#9f5a63", "#f4b8ae", "#ffe4e6"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#2b0f17",
    extrude: "#4c1d24",
    shimmer: "#ffffff",
    emblem: { shape: "crown", fill: "#f4b8ae", shine: "#fff1f2" },
  },
  sapphireIce: {
    color: "#60a5fa",
    highlight: "#ffffff",
    shade: "#1e3a8a",
    glow: "#60a5faaa",
    glowBlur: 12,
    sparkles: 4,
    sheen: ["#ffffff", "#dbeafe", "#60a5fa", "#1e40af", "#93c5fd", "#eff6ff"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#020617",
    rim: ["#e0f2fe", "#38bdf8", "#e0f2fe"],
    glints: 3,
    emblem: { shape: "gem", fill: "#60a5fa", shine: "#ffffff" },
  },
  chrome: {
    color: "#d1d5db",
    highlight: "#ffffff",
    shade: "#374151",
    glow: "#e5e7eb66",
    glowBlur: 8,
    sparkles: 3,
    // A hard light/dark split halfway down is the classic chrome reflection.
    sheen: ["#ffffff", "#e5e7eb", "#9ca3af", "#1f2937", "#6b7280", "#e5e7eb", "#ffffff"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#030712",
    rim: ["#9ca3af", "#ffffff", "#9ca3af"],
    shimmer: "#ffffff",
    glints: 2,
    emblem: { shape: "star", fill: "#d1d5db", shine: "#ffffff" },
  },
  cosmicHolo: {
    color: "#a5b4fc",
    highlight: "#ffffff",
    shade: "#f0abfc",
    glow: "#c4b5fdaa",
    glowBlur: 12,
    sparkles: 4,
    sheen: ["#f0abfc", "#a5b4fc", "#67e8f9", "#86efac", "#fde047", "#f0abfc"],
    sheenDirection: "diagonal",
    outline: "#0f0a2a",
    rim: ["#ffffff", "#f0abfc", "#67e8f9", "#ffffff"],
    shimmer: "#ffffff",
    emblem: { shape: "gem", fill: "#c4b5fd", shine: "#ffffff" },
  },
  royalAmethyst: {
    color: "#a78bfa",
    highlight: "#f5f3ff",
    shade: "#4c1d95",
    glow: "#8b5cf6aa",
    glowBlur: 12,
    sparkles: 3,
    sheen: ["#f5f3ff", "#c4b5fd", "#7c3aed", "#4c1d95", "#a78bfa"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#12052b",
    rim: ["#fde68a", "#b45309", "#fde68a"],
    glints: 2,
    emblem: { shape: "crown", fill: "#f5c542", shine: "#fff4c2" },
  },
} satisfies Record<string, PlayerNameStyle>;

export type LegendNameStyle = keyof typeof LEGEND_NAME_STYLES;

export const PLAYER_NAME_STYLES: Record<PlayerNameTier, PlayerNameStyle> = {
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
  // Legend headers supply their own style; this matches the active one for any other background.
  legend: LEGEND_NAME_STYLES.borealis,
};

/** Medal points within the selected game mode, as on `!profile`. */
export const playerMedalPoints = (medals: MapMedalCounts) =>
  medals.gold * MEDAL_POINTS.gold +
  medals.silver * MEDAL_POINTS.silver +
  medals.bronze * MEDAL_POINTS.bronze;

/** Thresholds use medal points, not medal counts. */
export const getPlayerNameTier = (medals: MapMedalCounts): PlayerNameTier => {
  const points = playerMedalPoints(medals);
  if (points >= 500) return "legend";
  if (points >= 200) return "explorer";
  if (points >= 120) return "platinum";
  if (points >= 40) return "rose";
  if (points >= 10) return "gold";
  return "white";
};

export const getPlayerNameStyle = (medals: MapMedalCounts): PlayerNameStyle =>
  PLAYER_NAME_STYLES[getPlayerNameTier(medals)];

const EMBLEM_WIDTH = 26;
const EMBLEM_GAP = 10;

const emblemSpace = (style: PlayerNameStyle) => (style.emblem ? EMBLEM_GAP + EMBLEM_WIDTH : 0);

export const playerNameDecorationWidth = (style: PlayerNameStyle) =>
  (emblemSpace(style) + (style.sparkles === 0 ? 0 : 12 + 14 * style.sparkles)) *
  MAP_RESOLUTION_SCALE;

/** Emblem outlines on a 26 × 26 grid whose bottom edge sits on the baseline. */
const EMBLEM_SHAPES: Record<PlayerNameEmblem["shape"], Array<[number, number]>> = {
  crown: [
    [0, 26],
    [0, 21],
    [2, 7],
    [8, 14],
    [13, 3],
    [18, 14],
    [24, 7],
    [26, 21],
    [26, 26],
  ],
  star: Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 13 : 5.5;
    return [13 + Math.cos(angle) * radius, 14 + Math.sin(angle) * radius] as [number, number];
  }),
  gem: [
    [5, 6],
    [21, 6],
    [26, 12],
    [13, 26],
    [0, 12],
  ],
};

const drawEmblem = (
  context: SKRSContext2D,
  emblem: PlayerNameEmblem,
  x: number,
  baseline: number,
  glow: string,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  const top = baseline - 28 * ui;
  const points = EMBLEM_SHAPES[emblem.shape];
  const gradient = context.createLinearGradient(0, top, 0, baseline);
  gradient.addColorStop(0, emblem.shine);
  gradient.addColorStop(0.55, emblem.fill);
  gradient.addColorStop(1, emblem.fill);
  context.save();
  context.shadowColor = glow;
  context.shadowBlur = 8 * ui;
  context.beginPath();
  points.forEach(([px, py], index) => {
    const method = index === 0 ? "moveTo" : "lineTo";
    context[method](x + px * ui, top + py * ui);
  });
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = emblem.shine;
  context.globalAlpha = 0.8;
  context.lineWidth = ui;
  context.beginPath();
  if (emblem.shape === "crown") {
    context.moveTo(x, top + 21 * ui);
    context.lineTo(x + 26 * ui, top + 21 * ui);
  } else if (emblem.shape === "gem") {
    context.moveTo(x, top + 12 * ui);
    context.lineTo(x + 26 * ui, top + 12 * ui);
    context.moveTo(x + 9 * ui, top + 6 * ui);
    context.lineTo(x + 13 * ui, top + 26 * ui);
    context.lineTo(x + 17 * ui, top + 6 * ui);
  }
  context.stroke();
  if (emblem.shape === "crown") {
    context.globalAlpha = 1;
    context.fillStyle = emblem.shine;
    for (const [px, py] of [
      [2, 7],
      [13, 3],
      [24, 7],
    ] as const) {
      context.beginPath();
      context.arc(x + px * ui, top + py * ui, 2.2 * ui, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
};

/** Metallic lettering and small sparkles preserve the normal name line's size. */
export const drawStyledPlayerName = (
  context: SKRSContext2D,
  name: string,
  x: number,
  baseline: number,
  style: PlayerNameStyle,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  const nameEnd = x + context.measureText(name).width;
  context.save();
  if (style.sparkles === 0) {
    context.fillStyle = style.color;
  } else {
    if (style.extrude) {
      context.fillStyle = style.extrude;
      for (let depth = 1; depth <= 3; depth++) {
        context.fillText(name, x + depth * 0.5 * ui, baseline + depth * ui);
      }
    }
    if (style.outline) {
      context.lineJoin = "round";
      context.lineWidth = (style.rim ? 5 : 4) * ui;
      context.strokeStyle = style.outline;
      context.strokeText(name, x, baseline);
    }
    if (style.rim) {
      const rim = context.createLinearGradient(x, baseline - 30 * ui, nameEnd, baseline);
      style.rim.forEach((color, index, colors) =>
        rim.addColorStop(index / (colors.length - 1), color),
      );
      context.lineJoin = "round";
      context.lineWidth = 2.2 * ui;
      context.strokeStyle = rim;
      context.strokeText(name, x, baseline);
    }
    const direction = style.sheen ? (style.sheenDirection ?? "horizontal") : "vertical";
    const gradient =
      direction === "horizontal"
        ? context.createLinearGradient(x, 0, nameEnd, 0)
        : direction === "diagonal"
          ? context.createLinearGradient(x, baseline - 30 * ui, nameEnd, baseline + 4 * ui)
          : context.createLinearGradient(0, baseline - 30 * ui, 0, baseline + 4 * ui);
    const stops = style.sheen ?? [style.highlight, style.color, style.shade];
    const offsets = style.sheen ? undefined : [0, 0.45, 1];
    stops.forEach((color, index) =>
      gradient.addColorStop(offsets?.[index] ?? index / (stops.length - 1), color),
    );
    context.fillStyle = gradient;
    context.shadowColor = style.glow;
    context.shadowBlur = (style.glowBlur ?? 2 + style.sparkles) * ui;
  }
  context.fillText(name, x, baseline);

  if (style.sheen && style.gloss !== false) {
    // A soft top highlight makes multi-color lettering read as polished metal.
    const gloss = context.createLinearGradient(0, baseline - 30 * ui, 0, baseline);
    gloss.addColorStop(0, `${style.highlight}d0`);
    gloss.addColorStop(0.5, `${style.highlight}00`);
    context.shadowBlur = 0;
    context.fillStyle = gloss;
    context.fillText(name, x, baseline);
  }

  if (style.shimmer) {
    // A narrow diagonal band of light, about a third of the way along the name.
    const width = nameEnd - x;
    const streak = context.createLinearGradient(x, baseline - 30 * ui, x + width * 0.6, baseline);
    streak.addColorStop(0.42, `${style.shimmer}00`);
    streak.addColorStop(0.5, `${style.shimmer}c0`);
    streak.addColorStop(0.58, `${style.shimmer}00`);
    context.shadowBlur = 0;
    context.fillStyle = streak;
    context.fillText(name, x, baseline);
  }

  if (style.glints) {
    // Fixed positions along the top of the letters keep renders identical.
    context.save();
    context.shadowColor = style.highlight;
    context.shadowBlur = 4 * ui;
    context.fillStyle = style.highlight;
    for (let index = 0; index < style.glints; index++) {
      const gx = x + ((nameEnd - x) * (index + 0.6)) / (style.glints + 0.4);
      const gy = baseline - (index % 2 === 0 ? 24 : 12) * ui;
      const size = (index % 2 === 0 ? 5 : 3.5) * ui;
      context.beginPath();
      context.moveTo(gx, gy - size);
      context.lineTo(gx + size * 0.2, gy - size * 0.2);
      context.lineTo(gx + size, gy);
      context.lineTo(gx + size * 0.2, gy + size * 0.2);
      context.lineTo(gx, gy + size);
      context.lineTo(gx - size * 0.2, gy + size * 0.2);
      context.lineTo(gx - size, gy);
      context.lineTo(gx - size * 0.2, gy - size * 0.2);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  if (style.emblem) {
    drawEmblem(context, style.emblem, nameEnd + EMBLEM_GAP * ui, baseline, style.glow);
  }

  const sparklesStart = nameEnd + emblemSpace(style) * ui;
  context.fillStyle = style.highlight;
  for (let index = 0; index < style.sparkles; index++) {
    const cx = sparklesStart + (10 + index * 14) * ui;
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
