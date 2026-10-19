import { loadRules } from "../../config/rules.ts";
import { imageOccasionOn } from "../holidays/national-holidays.ts";
import type { MapStyle } from "./map-renderer.ts";

/** The selected map theme plus the day's occasion, for maps posted now. */
export const currentMapStyle = async (date = new Date()): Promise<MapStyle> => ({
  theme: (await loadRules()).mapTheme,
  ...imageOccasionOn(date),
});
