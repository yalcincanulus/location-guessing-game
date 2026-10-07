import type { GameMode } from "../game/game-mode.ts";
import { messages } from "../../i18n/messages.ts";
import { renderMap } from "./map-renderer.ts";
import { renderProvinceMap } from "./province-map-renderer.ts";
import type { MapHeader, MapHighlights, MapMedalCounts } from "./map-header.ts";
import type { PlayerMapHeaderDesign } from "./player-map-header-designs.ts";

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
};

export const renderPlayerMap = ({
  kind,
  mode,
  playerName,
  medals,
  locationCodes,
  gameCount,
  generatedAt = new Date(),
  headerDesign,
}: RenderPlayerMapOptions) => {
  const codes = [...new Set(locationCodes)];
  const color = PLAYER_MAP_COLORS[kind];
  const header: MapHeader = {
    title: messages.playerMap.title(kind, mode),
    playerName,
    medals,
    summary: messages.playerMap.summary(kind, mode, gameCount, codes.length),
    generatedAt: messages.playerMap.generatedAt(generatedAt),
    color,
    design: headerDesign,
  };
  const highlights: MapHighlights = { codes, color, label: messages.playerMap.legend(kind, mode) };
  const map =
    mode === "province"
      ? renderProvinceMap({ wrongProvinces: [], highlights, header })
      : renderMap({ wrongCountries: [], highlights, header });

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
