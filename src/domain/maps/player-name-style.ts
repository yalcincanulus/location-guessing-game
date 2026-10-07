import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { MEDAL_POINTS } from "../awards/periods.ts";
import type { MapMedalCounts } from "./map-header.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

export type PlayerNameTier =
  | "white"
  | "gold"
  | "rose"
  | "platinum"
  | "explorer"
  | "legend"
  | "mythic";

export type PlayerNameEmblem = {
  shape: "crown" | "star" | "gem" | "sun" | "compass";
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
  /** Stacked glows behind the letters, innermost first. */
  aura?: readonly string[];
  /** Colors for the sparkles after the name, in order; without them they use `highlight`. */
  sparkleColors?: readonly string[];
  /** Thin dark lines across the letters, like a projected hologram. */
  scanlines?: string;
  /** Offset copies in two colors to the left and right, like a hologram. */
  chromatic?: readonly [left: string, right: string];
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

/** The Holo Command · Prime lettering effects (hologram fringes, scanlines, aura) in any colors. */
const holoNameStyle = ({
  sheen,
  sheenDirection,
  glow,
  aura,
  emblem,
  rim,
  accent,
  overrides,
}: {
  sheen: readonly string[];
  sheenDirection?: PlayerNameStyle["sheenDirection"];
  /** Glow and aura colors without alpha. */
  glow: string;
  aura: string;
  emblem: string;
  rim?: readonly string[];
  /** The avatar ring and tier chip color; a color near the middle of the gradient by default. */
  accent?: string;
  /** Any other lettering option, such as the emblem, sparkle color or scanlines. */
  overrides?: Partial<PlayerNameStyle>;
}): PlayerNameStyle => ({
  color: accent ?? sheen[Math.floor((sheen.length - 1) / 2)]!,
  highlight: "#fffbeb",
  shade: sheen.at(-1)!,
  glow: `${glow}aa`,
  glowBlur: 14,
  sparkles: 4,
  sheen,
  sheenDirection,
  // Vertical chrome bands keep their hard reflection line without a top gloss.
  gloss: sheenDirection !== "vertical",
  outline: "#0a0414",
  rim: rim ?? [sheen[0]!, "#22d3ee", sheen[0]!],
  shimmer: "#ffffff",
  glints: 3,
  chromatic: ["#00e5ff", "#ff2bd6"],
  scanlines: "#0a041438",
  aura: [`${aura}88`, "#22d3ee55"],
  emblem: { shape: "gem", fill: emblem, shine: "#fef9c3" },
  ...overrides,
});

/** Each mythic header design selects one of these; keep every option for later changes. */
export const MYTHIC_NAME_STYLES = {
  astrolabe: {
    color: "#f5c542",
    highlight: "#fffbea",
    shade: "#92400e",
    glow: "#f5c542aa",
    glowBlur: 14,
    sparkles: 4,
    sheen: ["#fffbea", "#fde68a", "#f5c542", "#92400e", "#fbbf24", "#fff7d6"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#050816",
    rim: ["#fffbea", "#b45309", "#fffbea", "#b45309"],
    shimmer: "#ffffff",
    glints: 3,
    aura: ["#f5c54288", "#3b82f666"],
    emblem: { shape: "sun", fill: "#f5c542", shine: "#fffbea" },
  },
  illuminated: {
    color: "#fcd34d",
    highlight: "#fffbeb",
    shade: "#a16207",
    glow: "#fcd34d88",
    glowBlur: 10,
    sparkles: 4,
    sheen: ["#fffbeb", "#fcd34d", "#d97706", "#fde68a", "#ca8a04"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#071330",
    rim: ["#bfdbfe", "#1d4ed8", "#bfdbfe"],
    extrude: "#0b1d4a",
    shimmer: "#ffffff",
    glints: 2,
    emblem: { shape: "compass", fill: "#fcd34d", shine: "#fffbeb" },
  },
  supernova: {
    color: "#fdba74",
    highlight: "#ffffff",
    shade: "#c026d3",
    glow: "#fb923ccc",
    glowBlur: 16,
    sparkles: 4,
    sheen: ["#ffffff", "#fef3c7", "#fdba74", "#f97316", "#e11d48", "#c026d3"],
    outline: "#0a0210",
    rim: ["#ffffff", "#fb923c", "#a855f7"],
    shimmer: "#ffffff",
    glints: 2,
    aura: ["#fb923caa", "#a855f766"],
    emblem: { shape: "sun", fill: "#fb923c", shine: "#ffffff" },
  },
  hologram: {
    color: "#67e8f9",
    highlight: "#ffffff",
    shade: "#e879f9",
    glow: "#22d3eeaa",
    glowBlur: 12,
    sparkles: 4,
    sheen: ["#a5f3fc", "#ffffff", "#67e8f9", "#818cf8", "#e879f9", "#a5f3fc"],
    sheenDirection: "diagonal",
    outline: "#020817",
    rim: ["#67e8f9", "#ffffff", "#e879f9"],
    shimmer: "#ffffff",
    glints: 3,
    chromatic: ["#ff2bd6", "#00e5ff"],
    emblem: { shape: "gem", fill: "#67e8f9", shine: "#ffffff" },
  },
  // Holo Command · Prime: sunrise plasma, away from the mint-to-violet legend lettering.
  plasma: holoNameStyle({
    sheen: ["#fef08a", "#fbbf24", "#fb923c", "#f43f5e", "#ec4899", "#f0abfc"],
    glow: "#f472b6",
    aura: "#f472b6",
    emblem: "#fb923c",
  }),
  // More Holo Command · Prime gradients; every one is kept so the active one can change later.
  solarFlare: holoNameStyle({
    sheen: ["#ffffff", "#fef08a", "#fbbf24", "#f97316", "#dc2626", "#991b1b"],
    glow: "#f97316",
    aura: "#ef4444",
    emblem: "#fbbf24",
  }),
  acid: holoNameStyle({
    sheen: ["#f7fee7", "#d9f99d", "#a3e635", "#facc15", "#fb923c"],
    glow: "#a3e635",
    aura: "#84cc16",
    emblem: "#a3e635",
  }),
  spectrum: holoNameStyle({
    sheen: ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"],
    glow: "#ffffff",
    aura: "#facc15",
    emblem: "#38bdf8",
  }),
  iceFire: holoNameStyle({
    sheen: ["#67e8f9", "#e0f2fe", "#ffffff", "#fdba74", "#f97316", "#e11d48"],
    glow: "#fb923c",
    aura: "#22d3ee",
    emblem: "#fdba74",
    accent: "#fdba74",
  }),
  crimsonChrome: holoNameStyle({
    sheen: ["#fff1f2", "#fda4af", "#e11d48", "#4c0519", "#fb7185", "#ffe4e6"],
    sheenDirection: "vertical",
    glow: "#e11d48",
    aura: "#fb7185",
    emblem: "#fb7185",
  }),
  goldChrome: holoNameStyle({
    sheen: ["#fffbeb", "#fde68a", "#f59e0b", "#78350f", "#fbbf24", "#fef3c7"],
    sheenDirection: "vertical",
    glow: "#f59e0b",
    aura: "#fbbf24",
    emblem: "#fbbf24",
    rim: ["#f472b6", "#22d3ee", "#a3e635", "#f472b6"],
  }),
  royalNeon: holoNameStyle({
    sheen: ["#fde047", "#fb7185", "#e879f9", "#a855f7", "#6366f1"],
    sheenDirection: "diagonal",
    glow: "#e879f9",
    aura: "#a855f7",
    emblem: "#e879f9",
  }),
  // Royal Neon with the yellow swapped for cyan or teal.
  royalNeonCyan: holoNameStyle({
    sheen: ["#67e8f9", "#fb7185", "#e879f9", "#a855f7", "#6366f1"],
    sheenDirection: "diagonal",
    glow: "#e879f9",
    aura: "#a855f7",
    emblem: "#e879f9",
  }),
  royalNeonTeal: holoNameStyle({
    sheen: ["#5eead4", "#fb7185", "#e879f9", "#a855f7", "#6366f1"],
    sheenDirection: "diagonal",
    glow: "#e879f9",
    aura: "#a855f7",
    emblem: "#e879f9",
  }),
  /** Two cyan stops give the cyan end more room before it turns coral. */
  royalNeonIce: holoNameStyle({
    sheen: ["#cffafe", "#22d3ee", "#fb7185", "#e879f9", "#a855f7", "#6366f1"],
    sheenDirection: "diagonal",
    glow: "#e879f9",
    aura: "#a855f7",
    emblem: "#e879f9",
    accent: "#e879f9",
  }),
  royalNeonLagoon: holoNameStyle({
    sheen: ["#2dd4bf", "#22d3ee", "#f472b6", "#d946ef", "#8b5cf6"],
    sheenDirection: "diagonal",
    glow: "#d946ef",
    aura: "#2dd4bf",
    emblem: "#2dd4bf",
    accent: "#f472b6",
  }),
  // Gold and yellow Holo Command · Prime options, each with a different finish.
  /** Lemon to deep amber, left to right, with the cyan holo rim. */
  neonGold: holoNameStyle({
    sheen: ["#fffbeb", "#fef08a", "#facc15", "#f59e0b", "#ea580c"],
    glow: "#f59e0b",
    aura: "#facc15",
    emblem: "#facc15",
  }),
  /** Light and dark gold alternate along the name, like poured metal. */
  moltenGold: holoNameStyle({
    sheen: ["#fff7d6", "#fde68a", "#f59e0b", "#b45309", "#f59e0b", "#fde68a", "#fff7d6"],
    glow: "#f97316",
    aura: "#f97316",
    emblem: "#f59e0b",
    rim: ["#fde68a", "#f97316", "#fde68a"],
    accent: "#f59e0b",
    overrides: {
      emblem: { shape: "crown", fill: "#f59e0b", shine: "#fff7d6" },
      // One more sparkle than the legend tier, all in gold.
      sparkles: 5,
      sparkleColors: ["#fbbf24"],
    },
  }),
  /** Bright, nearly white yellow with extra glints and no scanlines. */
  sunbeam: holoNameStyle({
    sheen: ["#ffffff", "#fef9c3", "#fde047", "#eab308", "#fef08a", "#ffffff"],
    sheenDirection: "diagonal",
    glow: "#fde047",
    aura: "#fde047",
    emblem: "#fde047",
    rim: ["#ffffff", "#fde047", "#ffffff"],
    accent: "#fde047",
    overrides: {
      glints: 5,
      scanlines: undefined,
      emblem: { shape: "star", fill: "#fde047", shine: "#ffffff" },
    },
  }),
  /** Deep amber glass with a glossy top. */
  honeyGlass: holoNameStyle({
    sheen: ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309", "#78350f"],
    sheenDirection: "vertical",
    glow: "#f59e0b",
    aura: "#d97706",
    emblem: "#f59e0b",
    rim: ["#fde68a", "#b45309", "#fde68a"],
    accent: "#fbbf24",
    overrides: { gloss: true, outline: "#1c0a02" },
  }),
  /** Gold lettering charged with cyan: cyan rim, aura, glints and sparkles. */
  electricGold: holoNameStyle({
    sheen: ["#fef08a", "#facc15", "#fffbeb", "#facc15", "#ca8a04"],
    glow: "#22d3ee",
    aura: "#22d3ee",
    emblem: "#facc15",
    rim: ["#a5f3fc", "#22d3ee", "#a5f3fc"],
    accent: "#facc15",
    overrides: { highlight: "#a5f3fc", glints: 4 },
  }),
  /** Soft champagne gold fading into rose gold, with a crown. */
  champagne: holoNameStyle({
    sheen: ["#fffbeb", "#fef3c7", "#fde68a", "#fbcfe8", "#fda4af"],
    glow: "#fda4af",
    aura: "#fde68a",
    emblem: "#fde68a",
    rim: ["#fffbeb", "#fda4af", "#fffbeb"],
    accent: "#fde68a",
    overrides: {
      emblem: { shape: "crown", fill: "#fde68a", shine: "#fffbeb" },
    },
  }),
  /** Gold with a near-black band through the middle. */
  blackGold: holoNameStyle({
    sheen: ["#fef9c3", "#fde047", "#facc15", "#eab308", "#422006", "#ca8a04", "#fde047", "#fef9c3"],
    sheenDirection: "vertical",
    glow: "#facc15",
    aura: "#ca8a04",
    emblem: "#facc15",
    rim: ["#fde047", "#a16207", "#fde047"],
    accent: "#facc15",
  }),
  /** Gold with a crimson rim and red aura, and a crown. */
  gildedRuby: holoNameStyle({
    sheen: ["#fff4c2", "#fcd34d", "#f59e0b", "#fcd34d", "#fff4c2"],
    glow: "#dc2626",
    aura: "#dc2626",
    emblem: "#f5c542",
    rim: ["#fecaca", "#dc2626", "#fecaca"],
    overrides: {
      emblem: { shape: "crown", fill: "#f5c542", shine: "#fff4c2" },
    },
  }),
  synthSun: holoNameStyle({
    sheen: ["#fde047", "#fb923c", "#f43f5e", "#c026d3", "#4f46e5"],
    sheenDirection: "vertical",
    glow: "#f43f5e",
    aura: "#c026d3",
    emblem: "#f43f5e",
  }),
  cherryBlossom: holoNameStyle({
    sheen: ["#ffffff", "#fce7f3", "#f9a8d4", "#f472b6", "#fda4af", "#fff1f2"],
    glow: "#f472b6",
    aura: "#f9a8d4",
    emblem: "#f9a8d4",
  }),
  imperial: {
    color: "#f5c542",
    highlight: "#fff4c2",
    shade: "#9a3412",
    glow: "#f59e0baa",
    glowBlur: 14,
    sparkles: 4,
    sheen: ["#fff4c2", "#f5c542", "#c8891e", "#fff1b8", "#d97706"],
    sheenDirection: "vertical",
    gloss: false,
    outline: "#1c0207",
    rim: ["#fecaca", "#b91c1c", "#fecaca"],
    extrude: "#5b0a14",
    shimmer: "#ffffff",
    glints: 3,
    aura: ["#f59e0b88", "#dc262666"],
    emblem: { shape: "crown", fill: "#f5c542", shine: "#fff4c2" },
  },
} satisfies Record<string, PlayerNameStyle>;

export type MythicNameStyle = keyof typeof MYTHIC_NAME_STYLES;

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
  // Mythic headers supply their own style; this matches the active one for any other background.
  mythic: MYTHIC_NAME_STYLES.moltenGold,
};

/** Medal points within the selected game mode, as on `!profile`. */
export const playerMedalPoints = (medals: MapMedalCounts) =>
  medals.gold * MEDAL_POINTS.gold +
  medals.silver * MEDAL_POINTS.silver +
  medals.bronze * MEDAL_POINTS.bronze;

/** Lowest medal points for each tier, in ascending order. */
export const PLAYER_NAME_TIER_THRESHOLDS: ReadonlyArray<[PlayerNameTier, number]> = [
  ["white", 0],
  ["gold", 10],
  ["rose", 40],
  ["platinum", 120],
  ["explorer", 200],
  ["legend", 500],
  ["mythic", 1000],
];

/** Thresholds use medal points, not medal counts. */
export const getPlayerNameTier = (medals: MapMedalCounts): PlayerNameTier => {
  const points = playerMedalPoints(medals);
  return PLAYER_NAME_TIER_THRESHOLDS.findLast(([, minimum]) => points >= minimum)![0];
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
  sun: Array.from({ length: 24 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 12;
    const radius = index % 2 === 0 ? 13 : 8;
    return [13 + Math.cos(angle) * radius, 14 + Math.sin(angle) * radius] as [number, number];
  }),
  compass: Array.from({ length: 16 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 8;
    const radius = index % 4 === 0 ? 13 : index % 2 === 0 ? 8 : 3.5;
    return [13 + Math.cos(angle) * radius, 14 + Math.sin(angle) * radius] as [number, number];
  }),
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
  } else if (emblem.shape === "sun" || emblem.shape === "compass") {
    context.arc(
      x + 13 * ui,
      top + 14 * ui,
      (emblem.shape === "sun" ? 5 : 2.5) * ui,
      0,
      Math.PI * 2,
    );
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
    style.aura?.forEach((color, index) => {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = (10 + index * 12) * ui;
      context.fillStyle = color;
      context.fillText(name, x, baseline);
      context.restore();
    });
    if (style.chromatic) {
      context.save();
      context.globalAlpha = 0.7;
      style.chromatic.forEach((color, index) => {
        context.fillStyle = color;
        context.fillText(name, x + (index === 0 ? -2.5 : 2.5) * ui, baseline);
      });
      context.restore();
    }
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

  if (style.scanlines) {
    // A repeating 1-in-3 line pattern only shows where the letters are drawn.
    const tile = createCanvas(1, 3 * ui);
    const tileContext = tile.getContext("2d");
    tileContext.fillStyle = style.scanlines;
    tileContext.fillRect(0, 0, 1, ui);
    context.shadowBlur = 0;
    context.fillStyle = context.createPattern(tile, "repeat")!;
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
    const color = style.sparkleColors?.[index % style.sparkleColors.length];
    // Colored sparkles fade less so the last ones keep their color.
    context.globalAlpha = 1 - index * (color ? 0.06 : 0.12);
    if (color) {
      // Colored sparkles keep a white-hot center and glow in their own color.
      const fill = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
      fill.addColorStop(0, "#ffffff");
      fill.addColorStop(0.35, color);
      fill.addColorStop(1, color);
      context.fillStyle = fill;
      context.shadowColor = color;
      context.shadowBlur = 6 * ui;
    }
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
