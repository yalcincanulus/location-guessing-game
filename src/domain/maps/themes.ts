export type MapTheme = {
  ocean: string;
  country: string;
  countryBorder: string;
  wrong: string;
  correct: string;
  legendBackground: string;
  legendText: string;
};

export const mapThemes = {
  classic: {
    ocean: "#dbeafe",
    country: "#f1f5f9",
    countryBorder: "#475569",
    wrong: "#ef4444",
    correct: "#22c55e",
    legendBackground: "#0f172ae0",
    legendText: "#ffffff",
  },
  midnight: {
    ocean: "#0f172a",
    country: "#1e293b",
    countryBorder: "#64748b",
    wrong: "#f87171",
    correct: "#4ade80",
    legendBackground: "#020617e6",
    legendText: "#f8fafc",
  },
  parchment: {
    ocean: "#e7e5e4",
    country: "#fafaf9",
    countryBorder: "#78716c",
    wrong: "#dc2626",
    correct: "#15803d",
    legendBackground: "#292524e6",
    legendText: "#fafaf9",
  },
  catppuccin: {
    ocean: "#11111b",
    country: "#313244",
    countryBorder: "#cdd6f4",
    wrong: "#f38ba8",
    correct: "#a6e3a1",
    legendBackground: "#11111be6",
    legendText: "#cdd6f4",
  },
  tailwindColorSlate: {
    ocean: "#020617",
    country: "#1e293b",
    countryBorder: "#64748b",
    wrong: "#9f1239",
    correct: "#059669",
    legendBackground: "#0f172a",
    legendText: "#f1f5f9",
  },
} as const satisfies Record<string, MapTheme>;

export type MapThemeName = keyof typeof mapThemes;

/** Change this to switch the active map theme. */
export const activeMapThemeName: MapThemeName = "tailwindColorSlate";

export const activeMapTheme: MapTheme = mapThemes[activeMapThemeName];
