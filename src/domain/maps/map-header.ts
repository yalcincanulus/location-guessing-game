import type { SKRSContext2D } from "@napi-rs/canvas";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";
import type { MapTheme } from "./themes.ts";
import {
  drawPlayerMapHeaderBackground,
  getPlayerMapHeaderDesign,
  type PlayerMapHeaderDesign,
} from "./player-map-header-designs.ts";
import {
  drawStyledPlayerName,
  getPlayerNameStyle,
  playerNameDecorationWidth,
} from "./player-name-style.ts";

export type MapHighlights = {
  codes: string[];
  color: string;
  label: string;
};

export type MapMedalCounts = {
  gold: number;
  silver: number;
  bronze: number;
};

export type MapHeader = {
  title: string;
  playerName: string;
  medals: MapMedalCounts;
  summary: string;
  generatedAt: string;
  color: string;
  design?: PlayerMapHeaderDesign;
};

export const MAP_HEADER_HEIGHT = 154 * MAP_RESOLUTION_SCALE;

const fitText = (context: SKRSContext2D, text: string, maxWidth: number) => {
  const singleLine = text.replace(/\s+/gu, " ").trim();
  if (context.measureText(singleLine).width <= maxWidth) {
    return singleLine;
  }
  const characters = Array.from(singleLine);
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) {
    characters.pop();
  }
  return `${characters.join("")}…`;
};

/** Canvas medals also render on the production image, which has no emoji font. */
const drawMedalIcon = (
  context: SKRSContext2D,
  x: number,
  baseline: number,
  rank: number,
  color: string,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  context.save();
  context.translate(x, baseline);
  for (const [points, fill] of [
    [
      [
        [4, -30],
        [11, -30],
        [19, -13],
        [12, -13],
      ],
      "#60a5fa",
    ],
    [
      [
        [17, -30],
        [24, -30],
        [16, -13],
        [9, -13],
      ],
      "#2563eb",
    ],
  ] as const) {
    context.fillStyle = fill;
    context.beginPath();
    points.forEach(([px, py], index) => {
      if (index === 0) context.moveTo(px * ui, py * ui);
      else context.lineTo(px * ui, py * ui);
    });
    context.closePath();
    context.fill();
  }
  context.fillStyle = color;
  context.strokeStyle = "#ffffff66";
  context.lineWidth = ui;
  context.beginPath();
  context.arc(14 * ui, -10 * ui, 11 * ui, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#1e293b";
  context.font = `bold ${12 * ui}px "DejaVu Sans", Arial, sans-serif`;
  context.textAlign = "center";
  context.fillText(String(rank), 14 * ui, -6 * ui);
  context.restore();
};

const drawPlayerName = (
  context: SKRSContext2D,
  header: MapHeader,
  padding: number,
  maxWidth: number,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  const baseline = 72 * ui;
  const nameGap = 24 * ui;
  const iconWidth = 28 * ui;
  const iconGap = 6 * ui;
  const groupGap = 18 * ui;
  const nameStyle = getPlayerNameStyle(header.medals);
  const decorationWidth = playerNameDecorationWidth(nameStyle);
  context.font = `bold ${24 * ui}px "DejaVu Sans", Arial, sans-serif`;
  const medals = [
    { count: header.medals.gold, color: "#fbbf24", rank: 1 },
    { count: header.medals.silver, color: "#cbd5e1", rank: 2 },
    { count: header.medals.bronze, color: "#c08457", rank: 3 },
  ].map((medal) => ({ ...medal, textWidth: context.measureText(String(medal.count)).width }));
  const medalsWidth =
    medals.reduce((width, medal) => width + iconWidth + iconGap + medal.textWidth, 0) +
    groupGap * (medals.length - 1);

  context.font = `bold ${32 * ui}px "DejaVu Sans", Arial, sans-serif`;
  const name = fitText(
    context,
    header.playerName,
    maxWidth - medalsWidth - nameGap - decorationWidth,
  );
  drawStyledPlayerName(context, name, padding, baseline, nameStyle);
  let x = padding + context.measureText(name).width + decorationWidth + nameGap;
  context.font = `bold ${24 * ui}px "DejaVu Sans", Arial, sans-serif`;
  for (const medal of medals) {
    drawMedalIcon(context, x, baseline, medal.rank, medal.color);
    context.fillText(String(medal.count), x + iconWidth + iconGap, baseline);
    x += iconWidth + iconGap + medal.textWidth + groupGap;
  }
};

/** A separate header above the map keeps titles clear of the geography. */
export const drawMapHeader = (
  context: SKRSContext2D,
  header: MapHeader,
  theme: MapTheme,
  width: number,
) => {
  const ui = MAP_RESOLUTION_SCALE;
  const padding = 32 * ui;
  const design = getPlayerMapHeaderDesign(header.medals, header.design);
  // Decorated bars reserve room for the atlas and compass, including with long names.
  const maxWidth = (design === "plain" ? width : width * 0.54) - padding * 2;
  context.fillStyle = theme.ocean;
  context.fillRect(0, 0, width, MAP_HEADER_HEIGHT);
  context.fillStyle = theme.legendBackground;
  context.fillRect(0, 0, width, MAP_HEADER_HEIGHT);
  drawPlayerMapHeaderBackground(context, design, width, MAP_HEADER_HEIGHT);
  context.fillStyle = header.color;

  context.font = `bold ${16 * ui}px "DejaVu Sans", Arial, sans-serif`;
  context.fillText(fitText(context, header.title, maxWidth), padding, 30 * ui);
  context.fillStyle = design === "plain" ? theme.legendText : "#f1f5f9";
  drawPlayerName(context, header, padding, maxWidth);
  context.font = `${17 * ui}px "DejaVu Sans", Arial, sans-serif`;
  context.fillText(fitText(context, header.summary, maxWidth), padding, 105 * ui);
  context.globalAlpha = 0.75;
  context.font = `${14 * ui}px "DejaVu Sans", Arial, sans-serif`;
  context.fillText(fitText(context, header.generatedAt, maxWidth), padding, 132 * ui);
  context.globalAlpha = 1;
  context.fillStyle = theme.countryBorder;
  context.fillRect(0, MAP_HEADER_HEIGHT - ui, width, ui);
};
