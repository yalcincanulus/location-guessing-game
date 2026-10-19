import type { GameMode } from "../game/game-mode.ts";
import { messages } from "../../i18n/messages.ts";
import { renderMap } from "./map-renderer.ts";
import { renderProvinceMap } from "./province-map-renderer.ts";
import type { MapHeader, MapHighlights, MapMedalCounts } from "./map-header.ts";
import type { PassportStamp, PlayerMapHeaderDesign } from "./player-map-header-designs.ts";
import { getCountryDisplayName } from "../countries/normalize-country-guess.ts";
import { getProvinceName } from "../provinces/normalize-province-guess.ts";
import { getLocationCentroid } from "./location-centroids.ts";
import { imageOccasionOn, type ImageOccasion } from "../holidays/national-holidays.ts";
import { MEMORIAL_HIGHLIGHT } from "./themes.ts";

export type PlayerMapKind = "wins" | "starts";

export const PLAYER_MAP_COLORS = {
  wins: "#d4af37",
  starts: "#8b5cf6",
} as const;

export type RenderPlayerMapOptions = {
  kind: PlayerMapKind;
  mode: GameMode;
  playerName: string;
  medals: MapMedalCounts;
  locationCodes: string[];
  gameCount: number;
  generatedAt?: Date;
  headerDesign?: PlayerMapHeaderDesign;
  /** The player's most-won locations, most wins first, for the passport header. */
  stamps?: Array<{ code: string; count: number }>;
  /** Defaults to the occasion on `generatedAt`. */
  occasion?: ImageOccasion;
};

const PASSPORT_STAMP_LIMIT = 6;

export const toPassportStamps = (
  mode: GameMode,
  locations: Array<{ code: string; count: number }>,
): PassportStamp[] =>
  locations.slice(0, PASSPORT_STAMP_LIMIT).map(({ code, count }) => ({
    code,
    count,
    name: (mode === "province"
      ? getProvinceName(code)
      : getCountryDisplayName(code, messages.locale)
    ).toLocaleUpperCase(messages.locale),
    coordinates: getLocationCentroid(mode, code),
  }));

export const renderPlayerMap = ({
  kind,
  mode,
  playerName,
  medals,
  locationCodes,
  gameCount,
  generatedAt = new Date(),
  headerDesign,
  stamps,
  occasion = imageOccasionOn(generatedAt),
}: RenderPlayerMapOptions) => {
  const codes = [...new Set(locationCodes)];
  const color = occasion.mourning ? MEMORIAL_HIGHLIGHT : PLAYER_MAP_COLORS[kind];
  const header: MapHeader = {
    title: messages.playerMap.title(kind, mode),
    playerName,
    medals,
    summary: messages.playerMap.summary(kind, mode, gameCount, codes.length),
    generatedAt: messages.playerMap.generatedAt(generatedAt),
    color,
    design: headerDesign,
    stamps: stamps && toPassportStamps(mode, stamps),
    mode,
  };
  const highlights: MapHighlights = { codes, color, label: messages.playerMap.legend(kind, mode) };
  const map =
    mode === "province"
      ? renderProvinceMap({ wrongProvinces: [], highlights, header, ...occasion })
      : renderMap({ wrongCountries: [], highlights, header, ...occasion });

  return {
    ...map,
    filename: `${mode}-${kind}-map-${new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Istanbul",
    }).format(generatedAt)}.png`,
  };
};
