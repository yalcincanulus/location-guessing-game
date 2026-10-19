import type { BotLocale } from "../../i18n/locale.ts";

/** Repeating ink drawn over a base colour. */
export type MapPattern = "hatch" | "crosshatch" | "dots" | "grid" | "stripes";

/** A solid colour, or a pattern of `ink` over `base`. Sizes are in unscaled map pixels. */
export type MapFill =
  | string
  | {
      base: string;
      pattern: MapPattern;
      ink: string;
      /** Distance between pattern repeats; defaults to 7. */
      spacing?: number;
      /** Line width, or dot radius for `dots`; defaults to 1.6. */
      weight?: number;
    };

export type MapTheme = {
  /** Shown by `!admin theme`; also accepted as the theme's name in the command. */
  names: Record<BotLocale, string>;
  descriptions: Record<BotLocale, string>;
  ocean: MapFill;
  country: string;
  countryBorder: string;
  wrong: MapFill;
  correct: MapFill;
  /** Edge around wrong guesses; helps patterns and small islands stand out. */
  wrongEdge?: string;
  /** Edge around the answer. */
  correctEdge?: string;
  /** Soft glow in each area's own colour around wrong guesses and the answer. */
  glow?: boolean;
  locationMarker: string;
  /** Ring around the location dot. Setting it also adds a thin outer edge in `locationMarker`. */
  locationMarkerRing?: string;
  locationCrosshair: string;
  legendBackground: string;
  legendText: string;
  /** Player-map colours; defaults to gold wins and purple starts. */
  playerMap?: { wins: string; starts: string };
};

/**
 * Selectable map themes. To add one, add an entry here: the key is its id in the database and in
 * `!admin theme <id>`, and `bun run preview:map-themes` renders it.
 */
export const MAP_THEMES = {
  slate: {
    names: { tr: "Arduvaz", en: "Slate" },
    descriptions: {
      tr: "Varsayılan koyu tema; bordo yanlışlar, zümrüt yeşili doğru",
      en: "The default dark theme; crimson wrong guesses, emerald answer",
    },
    ocean: "#020617",
    country: "#1e293b",
    countryBorder: "#64748b",
    wrong: "#9f1239",
    correct: "#059669",
    locationMarker: "#ef4444",
    locationCrosshair: "#ef444499",
    legendBackground: "#0f172a",
    legendText: "#f1f5f9",
  },
  classic: {
    names: { tr: "Klasik Atlas", en: "Classic Atlas" },
    descriptions: {
      tr: "Açık mavi denizler ve krem kara; turuncu yanlışlar, yeşil doğru",
      en: "Light blue seas and cream land; orange wrong guesses, green answer",
    },
    ocean: "#cfe3f3",
    country: "#f8f5ee",
    countryBorder: "#8a8f98",
    wrong: "#e4572e",
    correct: "#2e9e5b",
    wrongEdge: "#a63a1a",
    correctEdge: "#1d6b3c",
    locationMarker: "#111827",
    locationMarkerRing: "#ffffff",
    locationCrosshair: "#11182799",
    legendBackground: "#111827e0",
    legendText: "#ffffff",
    playerMap: { wins: "#c98a00", starts: "#7c3aed" },
  },
  parchment: {
    names: { tr: "Parşömen", en: "Parchment" },
    descriptions: {
      tr: "Eski harita; taralı kiremit yanlışlar, zeytin yeşili doğru",
      en: "An old chart; hatched terracotta wrong guesses, olive answer",
    },
    ocean: { base: "#cbb98f", pattern: "stripes", ink: "#bba774", spacing: 10, weight: 1.2 },
    country: "#efe3c6",
    countryBorder: "#8a6a45",
    wrong: { base: "#d08a63", pattern: "hatch", ink: "#7a2e17", spacing: 7, weight: 1.6 },
    wrongEdge: "#6b2a14",
    correct: "#55803d",
    correctEdge: "#2f4a22",
    locationMarker: "#3b2412",
    locationMarkerRing: "#f5ecd7",
    locationCrosshair: "#3b2412aa",
    legendBackground: "#3b2412e6",
    legendText: "#f5ecd7",
    playerMap: { wins: "#b07d1a", starts: "#7a4f9a" },
  },
  blueprint: {
    names: { tr: "Mavi Kopya", en: "Blueprint" },
    descriptions: {
      tr: "Teknik çizim; ızgaralı deniz, kafes taralı yanlışlar, kehribar doğru",
      en: "A technical drawing; gridded sea, cross-hatched wrong guesses, amber answer",
    },
    ocean: { base: "#0d3b66", pattern: "grid", ink: "#1d5185", spacing: 22, weight: 1 },
    country: "#14508a",
    countryBorder: "#8fb8df",
    wrong: { base: "#14508a", pattern: "crosshatch", ink: "#e6f0fa", spacing: 8, weight: 1.3 },
    wrongEdge: "#e6f0fa",
    correct: "#ffd166",
    correctEdge: "#fff3cf",
    locationMarker: "#0d3b66",
    locationMarkerRing: "#ffffff",
    locationCrosshair: "#ffffffaa",
    legendBackground: "#0a2d4fe6",
    legendText: "#e6f0fa",
    playerMap: { wins: "#ffd166", starts: "#f49cd4" },
  },
  accessible: {
    names: { tr: "Renk Körü Dostu", en: "Colour-Blind Friendly" },
    descriptions: {
      tr: "Okabe-Ito renkleri; taralı turuncu yanlışlar, gök mavisi doğru",
      en: "Okabe-Ito colours; hatched orange wrong guesses, sky blue answer",
    },
    ocean: "#0b1020",
    country: "#2a3142",
    countryBorder: "#7b8496",
    wrong: { base: "#d55e00", pattern: "hatch", ink: "#ffc08f", spacing: 8, weight: 1.4 },
    wrongEdge: "#ffc08f",
    correct: "#56b4e9",
    correctEdge: "#d6eefb",
    locationMarker: "#000000",
    locationMarkerRing: "#ffffff",
    locationCrosshair: "#f0e442aa",
    legendBackground: "#000000d9",
    legendText: "#ffffff",
    playerMap: { wins: "#e69f00", starts: "#cc79a7" },
  },
  neon: {
    names: { tr: "Neon", en: "Neon" },
    descriptions: {
      tr: "Gece şehri; parlayan pembe yanlışlar, camgöbeği doğru",
      en: "A city at night; glowing pink wrong guesses, cyan answer",
    },
    ocean: "#05010d",
    country: "#1b1030",
    countryBorder: "#4c3a7a",
    wrong: "#ff2e88",
    wrongEdge: "#ffa3cb",
    correct: "#00e5ff",
    correctEdge: "#b8f8ff",
    glow: true,
    locationMarker: "#fff200",
    locationMarkerRing: "#05010d",
    locationCrosshair: "#fff20099",
    legendBackground: "#05010de6",
    legendText: "#f5e9ff",
    playerMap: { wins: "#fff200", starts: "#ff2e88" },
  },
  newsprint: {
    names: { tr: "Gazete", en: "Newsprint" },
    descriptions: {
      tr: "Gazete baskısı; kırmızı noktalı yanlışlar, lacivert doğru",
      en: "A printed paper; red halftone wrong guesses, navy answer",
    },
    ocean: "#dcd8cf",
    country: "#fbfaf7",
    countryBorder: "#4b4b4b",
    wrong: { base: "#f6e3df", pattern: "dots", ink: "#c62828", spacing: 6, weight: 1.7 },
    wrongEdge: "#c62828",
    correct: "#1d3557",
    locationMarker: "#e63946",
    locationMarkerRing: "#ffffff",
    locationCrosshair: "#1d3557aa",
    legendBackground: "#1f1f1fe6",
    legendText: "#fbfaf7",
    playerMap: { wins: "#c98a00", starts: "#1d3557" },
  },
  mocha: {
    names: { tr: "Mocha", en: "Mocha" },
    descriptions: {
      tr: "Catppuccin pastelleri; pembe yanlışlar, açık yeşil doğru",
      en: "Catppuccin pastels; pink wrong guesses, light green answer",
    },
    ocean: "#11111b",
    country: "#313244",
    countryBorder: "#6c7086",
    wrong: "#f38ba8",
    correct: "#a6e3a1",
    locationMarker: "#fab387",
    locationCrosshair: "#fab38799",
    legendBackground: "#181825e6",
    legendText: "#cdd6f4",
    playerMap: { wins: "#f9e2af", starts: "#cba6f7" },
  },
} as const satisfies Record<string, MapTheme>;

export type MapThemeName = keyof typeof MAP_THEMES;

export const DEFAULT_MAP_THEME: MapThemeName = "slate";

export const MAP_THEME_NAMES = Object.keys(MAP_THEMES) as MapThemeName[];

export const isMapThemeName = (value: unknown): value is MapThemeName =>
  typeof value === "string" && Object.hasOwn(MAP_THEMES, value);

const normalizeThemeToken = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

/** Finds a theme by id or by its name in any locale, ignoring case, accents and spaces. */
export const findMapThemeName = (input: string): MapThemeName | undefined => {
  const token = normalizeThemeToken(input);
  return MAP_THEME_NAMES.find(
    (name) =>
      normalizeThemeToken(name) === token ||
      Object.values(MAP_THEMES[name].names).some((label) => normalizeThemeToken(label) === token),
  );
};

/**
 * Black and white for 10 November, whatever theme is selected. Wrong guesses are hatched, the
 * answer is solid white and the location is a black dot in a white ring, so the map still reads
 * without red and green.
 */
export const memorialMapTheme: MapTheme = {
  names: { tr: "10 Kasım", en: "10 November" },
  descriptions: { tr: "Siyah beyaz", en: "Black and white" },
  ocean: "#0a0a0a",
  country: "#2a2a2a",
  countryBorder: "#737373",
  wrong: { base: "#3f3f3f", pattern: "hatch", ink: "#d4d4d4" },
  wrongEdge: "#d4d4d4",
  correct: "#f5f5f5",
  locationMarker: "#0a0a0a",
  locationMarkerRing: "#ffffff",
  locationCrosshair: "#a3a3a3cc",
  legendBackground: "#000000d9",
  legendText: "#f5f5f5",
  playerMap: { wins: "#d4d4d4", starts: "#d4d4d4" },
};

/** The theme to draw with: 10 November beats the selected theme; unknown ids use the default. */
export const resolveMapTheme = ({
  theme,
  mourning,
}: {
  theme?: string;
  mourning?: boolean;
}): MapTheme => {
  if (mourning) return memorialMapTheme;
  return MAP_THEMES[isMapThemeName(theme) ? theme : DEFAULT_MAP_THEME];
};

/** The base colour of a fill, for places that need one solid colour. */
export const fillBaseColor = (fill: MapFill) => (typeof fill === "string" ? fill : fill.base);
