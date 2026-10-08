import { createCanvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import type { GameMode } from "../game/game-mode.ts";
import { PERIOD_TYPES, type PeriodType } from "../awards/periods.ts";
import { messages } from "../../i18n/messages.ts";
import { drawMedalIcon, type MapMedalCounts } from "./map-header.ts";
import {
  drawPlayerMapHeaderBackground,
  getPlayerMapHeaderDesign,
  getPlayerMapNameStyle,
  type PassportStamp,
} from "./player-map-header-designs.ts";
import {
  drawStyledPlayerName,
  getPlayerNameTier,
  PLAYER_NAME_TIER_THRESHOLDS,
  playerMedalPoints,
  playerNameDecorationWidth,
  type PlayerNameStyle,
} from "./player-name-style.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

const ui = MAP_RESOLUTION_SCALE;
const FONT = '"DejaVu Sans", Arial, sans-serif';
const CARD_WIDTH = 960;

export type ProfileCardInput = {
  mode: GameMode;
  playerName: string;
  /** The player's Discord avatar; without one the card draws their initial. */
  avatar?: Image;
  points: number;
  wins: number;
  participated: number;
  gamesStarted: number;
  guesses: number;
  gmMultiplier: number;
  medals: MapMedalCounts;
  achievementsUnlocked: number;
  /** Gold medals won per award period type. */
  periodWins: Record<PeriodType, number>;
  /** Most-won locations, most wins first, for backgrounds that show them. */
  stamps?: PassportStamp[];
};

type CardContext = {
  context: SKRSContext2D;
  input: ProfileCardInput;
  nameStyle: PlayerNameStyle;
  accent: string;
  format: (value: number) => string;
  percent: (ratio: number) => string;
  tileStyle: ProfileTileStyle;
};

/** Every layout stays here so the active one can change with a one-line edit. */
type CardLayout = { name: string; height: number; draw: (card: CardContext) => void };

const font = (size: number, weight = "") => `${weight} ${size * ui}px ${FONT}`.trim();

const roundRect = (
  context: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x * ui, y * ui, width * ui, height * ui, radius * ui);
};

const fitText = (context: SKRSContext2D, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  while (characters.length > 1 && context.measureText(`${characters.join("")}…`).width > maxWidth) {
    characters.pop();
  }
  return `${characters.join("")}…`;
};

/** Stat values must stay whole, so they shrink to fit instead of losing digits to an ellipsis. */
const setFittingFont = (
  context: SKRSContext2D,
  text: string,
  size: number,
  weight: string,
  maxWidth: number,
) => {
  context.font = font(size, weight);
  const width = context.measureText(text).width;
  if (width > maxWidth) context.font = font(Math.floor((size * maxWidth) / width), weight);
};

/** Lower tiers have no decorated background; a dark card tinted with the tier color stands in. */
const drawPlainBackground = (
  context: SKRSContext2D,
  width: number,
  height: number,
  accent: string,
) => {
  const base = context.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#0f172a");
  base.addColorStop(0.5, "#131c33");
  base.addColorStop(1, "#0f172a");
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  for (const [x, y, radius, alpha] of [
    [0.88, 0, 0.55, "30"],
    [0.05, 1, 0.4, "18"],
  ] as const) {
    const glow = context.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      width * radius,
    );
    glow.addColorStop(0, `${accent}${alpha}`);
    glow.addColorStop(1, `${accent}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = `${accent}0d`;
  context.lineWidth = ui;
  context.beginPath();
  for (let offset = -height; offset < width; offset += 18 * ui) {
    context.moveTo(offset, height);
    context.lineTo(offset + height, 0);
  }
  context.stroke();
};

/** The tier's map header background, stretched over `height` card pixels from the top. */
const drawTierBackground = (card: CardContext, height: number) => {
  const { context, input, accent } = card;
  const design = getPlayerMapHeaderDesign(input.medals);
  const width = CARD_WIDTH * ui;
  if (design === "plain") {
    drawPlainBackground(context, width, height * ui, accent);
  } else {
    context.fillStyle = "#0b1020";
    context.fillRect(0, 0, width, height * ui);
    drawPlayerMapHeaderBackground(context, design, width, height * ui, {
      stamps: input.stamps,
      mode: input.mode,
    });
  }
};

const drawAvatar = (card: CardContext, cx: number, cy: number, radius: number) => {
  const { context, input, accent } = card;
  context.save();
  context.shadowColor = accent;
  context.shadowBlur = 16 * ui;
  context.fillStyle = accent;
  context.beginPath();
  context.arc(cx * ui, cy * ui, (radius + 4) * ui, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.save();
  context.beginPath();
  context.arc(cx * ui, cy * ui, radius * ui, 0, Math.PI * 2);
  context.clip();
  if (input.avatar) {
    context.drawImage(
      input.avatar,
      (cx - radius) * ui,
      (cy - radius) * ui,
      radius * 2 * ui,
      radius * 2 * ui,
    );
  } else {
    const fill = context.createLinearGradient(0, (cy - radius) * ui, 0, (cy + radius) * ui);
    fill.addColorStop(0, "#334155");
    fill.addColorStop(1, "#0f172a");
    context.fillStyle = fill;
    context.fillRect((cx - radius) * ui, (cy - radius) * ui, radius * 2 * ui, radius * 2 * ui);
    context.fillStyle = accent;
    context.font = font(radius * 0.9, "bold");
    context.textAlign = "center";
    context.textBaseline = "middle";
    const initial = Array.from(input.playerName.trim())[0] ?? "?";
    context.fillText(
      initial.toLocaleUpperCase(messages.locale),
      cx * ui,
      (cy + radius * 0.05) * ui,
    );
  }
  context.restore();
};

const drawName = (card: CardContext, x: number, baseline: number, maxWidth: number) => {
  const { context, input, nameStyle } = card;
  context.save();
  context.font = font(32, "bold");
  const name = fitText(
    context,
    input.playerName,
    maxWidth * ui - playerNameDecorationWidth(nameStyle),
  );
  drawStyledPlayerName(context, name, x * ui, baseline * ui, nameStyle);
  context.restore();
};

/** Tier name chip followed by the medal point total. */
const drawTierLine = (card: CardContext, x: number, y: number) => {
  const { context, input, accent, format } = card;
  const tierName = messages.profileCard.tierNames[getPlayerNameTier(input.medals)];
  context.save();
  context.font = font(12, "bold");
  const label = tierName.toLocaleUpperCase(messages.locale);
  const chipWidth = context.measureText(label).width / ui + 20;
  roundRect(context, x, y, chipWidth, 22, 11);
  context.fillStyle = `${accent}26`;
  context.fill();
  context.strokeStyle = `${accent}b0`;
  context.lineWidth = ui;
  context.stroke();
  context.fillStyle = accent;
  context.textBaseline = "middle";
  context.fillText(label, (x + 10) * ui, (y + 11.5) * ui);
  context.font = font(14);
  context.fillStyle = "#cbd5e1";
  context.fillText(
    messages.profileCard.medalPoints(format(playerMedalPoints(input.medals))),
    (x + chipWidth + 10) * ui,
    (y + 11.5) * ui,
  );
  context.restore();
};

/** Medal icons and counts; large counts shrink the text and gaps to stay within `maxWidth`. */
const drawMedals = (
  card: CardContext,
  x: number,
  baseline: number,
  size = 24,
  maxWidth = Number.POSITIVE_INFINITY,
) => {
  const { context, input, format } = card;
  const medals = [
    [1, input.medals.gold, "#fbbf24"],
    [2, input.medals.silver, "#cbd5e1"],
    [3, input.medals.bronze, "#c08457"],
  ] as const;
  const texts = medals.map(([, count]) => format(count));
  context.save();
  let gap = 22;
  const widthAt = (fontSize: number) => {
    context.font = font(fontSize, "bold");
    const textWidth = texts.reduce((sum, text) => sum + context.measureText(text).width / ui, 0);
    return medals.length * 34 + textWidth + gap * (medals.length - 1);
  };
  while (widthAt(size) > maxWidth && gap > 12) gap -= 2;
  while (widthAt(size) > maxWidth && size > 14) size -= 1;
  context.font = font(size, "bold");
  let cursor = x * ui;
  medals.forEach(([rank, , color], index) => {
    drawMedalIcon(context, cursor, baseline * ui, rank, color);
    context.fillStyle = "#f1f5f9";
    context.fillText(texts[index]!, cursor + 34 * ui, baseline * ui);
    cursor += 34 * ui + context.measureText(texts[index]!).width + gap * ui;
  });
  context.restore();
};

type StatIcon = "points" | "wins" | "winRate" | "started" | "guesses" | "multiplier";
type TileRect = [x: number, y: number, width: number, height: number];

/** Small line icons on a 20 × 20 grid centred on (cx, cy), in card units. */
const drawStatIcon = (
  context: SKRSContext2D,
  icon: StatIcon,
  cx: number,
  cy: number,
  color: string,
) => {
  const at = (x: number, y: number): [number, number] => [(cx + x - 10) * ui, (cy + y - 10) * ui];
  const polygon = (points: Array<[number, number]>) => {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(...at(x, y));
      else context.lineTo(...at(x, y));
    });
    context.closePath();
  };
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.6 * ui;
  context.lineJoin = "round";
  context.lineCap = "round";
  switch (icon) {
    case "points":
      polygon(
        Array.from({ length: 10 }, (_, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI) / 5;
          const radius = index % 2 === 0 ? 9 : 4;
          return [10 + Math.cos(angle) * radius, 10.5 + Math.sin(angle) * radius];
        }),
      );
      context.fill();
      break;
    case "wins":
      context.beginPath();
      context.moveTo(...at(5, 3));
      context.lineTo(...at(15, 3));
      context.lineTo(...at(15, 8));
      context.arc(...at(10, 8), 5 * ui, 0, Math.PI);
      context.closePath();
      context.fill();
      context.beginPath();
      context.arc(...at(5, 6.5), 2.5 * ui, Math.PI / 2, Math.PI * 1.5);
      context.moveTo(...at(15, 4));
      context.arc(...at(15, 6.5), 2.5 * ui, -Math.PI / 2, Math.PI / 2);
      context.moveTo(...at(10, 13));
      context.lineTo(...at(10, 16));
      context.moveTo(...at(6.5, 17));
      context.lineTo(...at(13.5, 17));
      context.stroke();
      break;
    case "winRate":
      context.beginPath();
      context.arc(...at(10, 10), 8 * ui, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(...at(10, 10));
      context.arc(...at(10, 10), 8 * ui, -Math.PI / 2, Math.PI * 0.3);
      context.closePath();
      context.fill();
      break;
    case "started":
      context.beginPath();
      context.moveTo(...at(5, 18));
      context.lineTo(...at(5, 2));
      context.stroke();
      polygon([
        [5, 2.5],
        [16, 5],
        [5, 10.5],
      ]);
      context.fill();
      break;
    case "guesses":
      context.beginPath();
      context.arc(...at(10, 8), 6 * ui, Math.PI * 0.85, Math.PI * 0.15);
      context.lineTo(...at(10, 18));
      context.closePath();
      context.fill();
      context.fillStyle = "#0b1120";
      context.beginPath();
      context.arc(...at(10, 8), 2.4 * ui, 0, Math.PI * 2);
      context.fill();
      break;
    case "multiplier":
      polygon([
        [12, 1.5],
        [4, 11],
        [9.5, 11],
        [8, 18.5],
        [16, 8.5],
        [10.5, 8.5],
      ]);
      context.fill();
      break;
  }
  context.restore();
};

/**
 * Ways to tie a stat tile to the tier color. `decorate` runs after the tile background;
 * `valueFill` replaces the white value text. Every option stays here for later changes.
 */
type TileStyle = {
  name: string;
  decorate?: (card: CardContext, rect: TileRect, icon: StatIcon) => void;
  valueFill?: (card: CardContext, rect: TileRect) => ReturnType<typeof sheenGradient>;
};

const sheenGradient = (card: CardContext, x0: number, x1: number) => {
  const { context, nameStyle } = card;
  const gradient = context.createLinearGradient(x0 * ui, 0, x1 * ui, 0);
  const stops = nameStyle.sheen ?? [nameStyle.highlight, nameStyle.color, nameStyle.shade];
  stops.forEach((color, index) => gradient.addColorStop(index / (stops.length - 1), color));
  return gradient;
};

export const PROFILE_TILE_STYLES = {
  accentBar: {
    name: "Accent bar",
    decorate: ({ context, accent }, [x, y, , height]) => {
      context.fillStyle = accent;
      context.fillRect(x * ui, (y + 14) * ui, 3 * ui, (height - 28) * ui);
    },
  },
  icon: {
    name: "Icon",
    // Bottom right, beside the short label, so the value keeps the full width.
    decorate: ({ context, accent }, [x, y, width, height], icon) => {
      const cx = x + width - 30;
      const cy = y + height - 28;
      context.fillStyle = `${accent}1f`;
      context.strokeStyle = `${accent}55`;
      context.lineWidth = ui;
      context.beginPath();
      context.arc(cx * ui, cy * ui, 16 * ui, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      drawStatIcon(context, icon, cx, cy, accent);
    },
  },
  sheenEdge: {
    name: "Sheen edge",
    decorate: (card, [x, y, width, height]) => {
      const { context, accent } = card;
      const tint = context.createLinearGradient(0, y * ui, 0, (y + height) * ui);
      tint.addColorStop(0, `${accent}1c`);
      tint.addColorStop(0.6, `${accent}00`);
      roundRect(context, x, y, width, height, 14);
      context.fillStyle = tint;
      context.fill();
      context.save();
      context.shadowColor = card.nameStyle.glow;
      context.shadowBlur = 8 * ui;
      context.fillStyle = sheenGradient(card, x + 14, x + width - 14);
      context.fillRect((x + 14) * ui, y * ui, (width - 28) * ui, 2 * ui);
      context.restore();
    },
  },
  cornerGlow: {
    name: "Corner glow",
    decorate: ({ context, accent }, [x, y, width, height]) => {
      context.save();
      roundRect(context, x, y, width, height, 14);
      context.clip();
      const glow = context.createRadialGradient(
        (x + width) * ui,
        y * ui,
        0,
        (x + width) * ui,
        y * ui,
        width * 0.75 * ui,
      );
      glow.addColorStop(0, `${accent}40`);
      glow.addColorStop(1, `${accent}00`);
      context.fillStyle = glow;
      context.fillRect(x * ui, y * ui, width * ui, height * ui);
      context.restore();
      roundRect(context, x, y, width, height, 14);
      context.strokeStyle = `${accent}30`;
      context.lineWidth = ui;
      context.stroke();
    },
  },
  gradientValue: {
    name: "Gradient numbers",
    valueFill: (card, [x, , width]) => sheenGradient(card, x + 18, x + width - 18),
  },
} satisfies Record<string, TileStyle>;

export type ProfileTileStyle = keyof typeof PROFILE_TILE_STYLES;

export const activeProfileTileStyle: ProfileTileStyle = "gradientValue";

const drawTile = (
  card: CardContext,
  rect: TileRect,
  value: string,
  label: string,
  icon: StatIcon,
  valueSize = 26,
) => {
  const { context } = card;
  const [x, y, width, height] = rect;
  const style: TileStyle = PROFILE_TILE_STYLES[card.tileStyle];
  const labelWidth = (width - (card.tileStyle === "icon" ? 66 : 32)) * ui;
  context.save();
  roundRect(context, x, y, width, height, 14);
  context.fillStyle = "#ffffff0d";
  context.fill();
  context.strokeStyle = "#ffffff14";
  context.lineWidth = ui;
  context.stroke();
  style.decorate?.(card, rect, icon);
  context.fillStyle = style.valueFill?.(card, rect) ?? "#f8fafc";
  setFittingFont(context, value, valueSize, "bold", (width - 32) * ui);
  context.fillText(value, (x + 18) * ui, (y + height / 2 + 2) * ui);
  context.fillStyle = "#94a3b8";
  context.font = font(12);
  context.fillText(fitText(context, label, labelWidth), (x + 18) * ui, (y + height / 2 + 22) * ui);
  context.restore();
};

const PERIOD_COLORS: Record<PeriodType, string> = {
  daily: "#38bdf8",
  weekly: "#a78bfa",
  monthly: "#f472b6",
  seasonal: "#34d399",
  yearly: "#fbbf24",
};

/** One icon per period type on a 20 × 20 grid centred on (cx, cy), in card units. */
const drawPeriodIcon = (
  context: SKRSContext2D,
  periodType: PeriodType,
  cx: number,
  cy: number,
  color: string,
  scale = 1,
) => {
  const at = (x: number, y: number): [number, number] => [
    (cx + (x - 10) * scale) * ui,
    (cy + (y - 10) * scale) * ui,
  ];
  const s = scale * ui;
  context.save();
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.6 * s;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  switch (periodType) {
    case "daily":
      context.arc(...at(10, 10), 4.2 * s, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        context.moveTo(...at(10 + Math.cos(angle) * 6.6, 10 + Math.sin(angle) * 6.6));
        context.lineTo(...at(10 + Math.cos(angle) * 9, 10 + Math.sin(angle) * 9));
      }
      context.stroke();
      break;
    case "weekly":
      context.roundRect(...at(2.5, 3.5), 15 * s, 14.5 * s, 2.5 * s);
      context.moveTo(...at(2.5, 7.5));
      context.lineTo(...at(17.5, 7.5));
      context.stroke();
      for (const [x, y] of [
        [6.5, 11],
        [10, 11],
        [13.5, 11],
        [6.5, 14.5],
        [10, 14.5],
      ]) {
        context.beginPath();
        context.arc(...at(x!, y!), 1.1 * s, 0, Math.PI * 2);
        context.fill();
      }
      break;
    case "monthly": {
      // Crescent: the outer disc minus an offset disc. The two arcs must meet exactly where
      // the circles cross, or the tips come out chipped, so the crossing angles are computed.
      const [x1, y1, r1] = [10, 10, 8];
      const [x2, y2, r2] = [14, 6.5, 7];
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const along = (r1 * r1 - r2 * r2 + distance * distance) / (2 * distance);
      const across = Math.sqrt(r1 * r1 - along * along);
      const [ux, uy] = [(x2 - x1) / distance, (y2 - y1) / distance];
      const [bx, by] = [x1 + ux * along, y1 + uy * along];
      const tips = [
        [bx - uy * across, by + ux * across],
        [bx + uy * across, by - ux * across],
      ] as const;
      const angle = (cx: number, cy: number, [px, py]: readonly [number, number]) =>
        Math.atan2(py - cy, px - cx);
      // Outer rim clockwise from the lower tip, round the far side, to the upper tip; then
      // back along the inner edge of the cut-out.
      context.arc(...at(x1, y1), r1 * s, angle(x1, y1, tips[0]), angle(x1, y1, tips[1]));
      context.arc(...at(x2, y2), r2 * s, angle(x2, y2, tips[1]), angle(x2, y2, tips[0]), true);
      context.closePath();
      context.fill();
      break;
    }
    case "seasonal":
      context.moveTo(...at(3.5, 16.5));
      context.quadraticCurveTo(...at(3, 3.5), ...at(16.5, 3.5));
      context.quadraticCurveTo(...at(17, 16.5), ...at(3.5, 16.5));
      context.fill();
      // The leaf sits on a gold medal, so its vein is cut in gold.
      context.strokeStyle = GOLD;
      context.lineWidth = 1.2 * s;
      context.beginPath();
      context.moveTo(...at(4.5, 15.5));
      context.lineTo(...at(13, 7));
      context.stroke();
      break;
    case "yearly":
      for (const [x, y] of [
        [2.5, 6],
        [6.8, 10.5],
        [10, 3.5],
        [13.2, 10.5],
        [17.5, 6],
        [16, 15],
        [4, 15],
      ]) {
        context.lineTo(...at(x!, y!));
      }
      context.closePath();
      context.fill();
      context.fillRect(...at(4, 16.3), 12 * s, 2 * s);
      break;
  }
  context.restore();
};

const GOLD = "#fbbf24";

/**
 * Period wins as small gold medals, the period glyph stamped where the rank number goes and
 * the ribbon in the period colour. With `goldMedal` (the centre bottom of the gold count's
 * medal) a gold bracket hangs them from that medal so they read as a split of its count.
 * Periods without a win are left out.
 */
const drawPeriodWins = (
  card: CardContext,
  x: number,
  y: number,
  width: number,
  goldMedal?: [x: number, y: number],
) => {
  const { context, input, format } = card;
  const won = PERIOD_TYPES.filter((periodType) => input.periodWins[periodType] > 0);
  // Five columns share the width; fewer stay at a readable size and keep to the left.
  const column = Math.min(width / won.length, 64);
  const centers = won.map((_, index) => x + column * index + column / 2);
  context.save();

  if (goldMedal) {
    const [stemX, stemTop] = goldMedal;
    context.strokeStyle = `${GOLD}99`;
    context.lineWidth = 1.5 * ui;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(stemX * ui, stemTop * ui);
    context.lineTo(stemX * ui, y * ui);
    context.moveTo(Math.min(stemX, centers[0]!) * ui, y * ui);
    context.lineTo(centers.at(-1)! * ui, y * ui);
    for (const cx of centers) {
      context.moveTo(cx * ui, y * ui);
      context.lineTo(cx * ui, (y + 8) * ui);
    }
    context.stroke();
  }

  context.textAlign = "center";
  won.forEach((periodType, index) => {
    const cx = centers[index]!;
    const ribbon = PERIOD_COLORS[periodType];
    const top = y + 8;
    for (const [points, fill] of [
      [
        [
          [-8, 0],
          [-3, 0],
          [2, 12],
          [-3, 12],
        ],
        ribbon,
      ],
      [
        [
          [3, 0],
          [8, 0],
          [3, 12],
          [-2, 12],
        ],
        `${ribbon}b3`,
      ],
    ] as const) {
      context.beginPath();
      points.forEach(([px, py]) => context.lineTo((cx + px) * ui, (top + py) * ui));
      context.closePath();
      context.fillStyle = fill;
      context.fill();
    }
    const cy = y + 28;
    const disc = context.createRadialGradient(
      (cx - 3) * ui,
      (cy - 4) * ui,
      0,
      cx * ui,
      cy * ui,
      11 * ui,
    );
    disc.addColorStop(0, "#fde68a");
    disc.addColorStop(1, GOLD);
    context.beginPath();
    context.arc(cx * ui, cy * ui, 11 * ui, 0, Math.PI * 2);
    context.fillStyle = disc;
    context.fill();
    context.strokeStyle = "#ffffff66";
    context.lineWidth = ui;
    context.stroke();
    drawPeriodIcon(context, periodType, cx, cy, "#78350f", 0.62);

    const value = format(input.periodWins[periodType]);
    const label = messages.profileCard.periodNames[periodType];
    context.fillStyle = "#f8fafc";
    setFittingFont(context, value, 17, "bold", (column - 6) * ui);
    context.fillText(value, cx * ui, (y + 60) * ui);
    context.fillStyle = "#94a3b8";
    setFittingFont(context, label, 10.5, "", (column - 4) * ui);
    context.fillText(label, cx * ui, (y + 76) * ui);
  });
  context.restore();
};

const hasPeriodWins = (input: ProfileCardInput) =>
  PERIOD_TYPES.some((periodType) => input.periodWins[periodType] > 0);

const tierProgress = (input: ProfileCardInput) => {
  const points = playerMedalPoints(input.medals);
  const index = PLAYER_NAME_TIER_THRESHOLDS.findLastIndex(([, minimum]) => points >= minimum);
  const [, current] = PLAYER_NAME_TIER_THRESHOLDS[index]!;
  const next = PLAYER_NAME_TIER_THRESHOLDS[index + 1];
  if (!next) return { ratio: 1, label: messages.profileCard.topTier };
  return {
    ratio: (points - current) / (next[1] - current),
    label: messages.profileCard.nextTier(
      messages.profileCard.tierNames[next[0]],
      String(next[1] - points),
    ),
  };
};

const drawProgress = (card: CardContext, x: number, y: number, width: number) => {
  const { context, input, nameStyle } = card;
  const { ratio, label } = tierProgress(input);
  context.save();
  context.fillStyle = "#94a3b8";
  context.font = font(12);
  context.fillText(label, x * ui, y * ui);
  roundRect(context, x, y + 8, width, 8, 4);
  context.fillStyle = "#ffffff14";
  context.fill();
  const fill = context.createLinearGradient(x * ui, 0, (x + width) * ui, 0);
  const stops = nameStyle.sheen ?? [nameStyle.highlight, nameStyle.color, nameStyle.shade];
  stops.forEach((color, index) => fill.addColorStop(index / (stops.length - 1), color));
  context.shadowColor = nameStyle.glow;
  context.shadowBlur = 6 * ui;
  roundRect(context, x, y + 8, Math.max(8, width * ratio), 8, 4);
  context.fillStyle = fill;
  context.fill();
  context.restore();
};

const drawCaption = (
  card: CardContext,
  text: string,
  x: number,
  y: number,
  align: "left" | "right",
) => {
  const { context } = card;
  context.save();
  context.font = font(12, "bold");
  const width = context.measureText(text).width / ui + 20;
  const left = align === "right" ? x - width : x;
  roundRect(context, left, y, width, 24, 12);
  context.fillStyle = "#05081aaa";
  context.fill();
  context.fillStyle = "#e2e8f0";
  context.textBaseline = "middle";
  context.fillText(text, (left + 10) * ui, (y + 12.5) * ui);
  context.restore();
};

const winRate = (input: ProfileCardInput) =>
  input.participated === 0 ? 0 : input.wins / input.participated;

/** Decorated banner on top; stat tiles, medals and tier progress below. */
const bannerLayout: CardLayout = {
  name: "Banner",
  height: 476,
  draw: (card) => {
    const { context, input, format } = card;
    const bannerHeight = 196;
    context.fillStyle = "#0b1120";
    context.fillRect(0, 0, CARD_WIDTH * ui, 476 * ui);
    drawTierBackground(card, bannerHeight);
    const fade = context.createLinearGradient(0, 130 * ui, 0, bannerHeight * ui);
    fade.addColorStop(0, "#0b112000");
    fade.addColorStop(1, "#0b1120");
    context.fillStyle = fade;
    context.fillRect(0, 130 * ui, CARD_WIDTH * ui, (bannerHeight - 130) * ui);
    drawAvatar(card, 100, 118, 58);
    drawName(card, 182, 116, 420);
    drawTierLine(card, 184, 134);

    const tile = (column: number, row: number): [number, number, number, number] => [
      40 + column * 194,
      214 + row * 98,
      180,
      84,
    ];
    drawTile(card, tile(0, 0), format(input.points), messages.profileCard.points, "points");
    drawTile(
      card,
      tile(1, 0),
      `${format(input.wins)} / ${format(input.participated)}`,
      `${messages.profileCard.wins} / ${messages.profileCard.participated}`,
      "wins",
    );
    drawTile(
      card,
      tile(2, 0),
      card.percent(winRate(input)),
      messages.profileCard.winRate,
      "winRate",
    );
    drawTile(
      card,
      tile(0, 1),
      format(input.gamesStarted),
      messages.profileCard.gamesStarted,
      "started",
    );
    drawTile(card, tile(1, 1), format(input.guesses), messages.profileCard.guesses, "guesses");
    drawTile(
      card,
      tile(2, 1),
      `${input.gmMultiplier.toFixed(2)}x`,
      messages.profileCard.multiplier,
      "multiplier",
    );

    // Medal panel on the right.
    roundRect(context, 628, 214, 292, 182, 14);
    context.fillStyle = "#ffffff0d";
    context.fill();
    context.strokeStyle = "#ffffff14";
    context.lineWidth = ui;
    context.stroke();
    context.fillStyle = "#94a3b8";
    context.font = font(12, "bold");
    context.fillText(
      messages.profileCard.medals.toLocaleUpperCase(messages.locale),
      648 * ui,
      242 * ui,
    );
    if (hasPeriodWins(input)) {
      drawMedals(card, 648, 282, 24, 252);
      // drawMedals puts the gold disc's centre 14 right of `x` and 10 above the baseline.
      drawPeriodWins(card, 648, 296, 252, [662, 286]);
    } else {
      // Without period wins the panel keeps its medal point line instead of going empty.
      drawMedals(card, 648, 296, 24, 252);
      context.fillStyle = "#cbd5e1";
      context.font = font(15);
      context.fillText(
        messages.profileCard.medalPoints(format(playerMedalPoints(input.medals))),
        648 * ui,
        336 * ui,
      );
    }
    drawProgress(card, 40, 428, 880);
    context.fillStyle = "#64748b";
    context.font = font(12, "bold");
    context.textAlign = "right";
    // The medal panel holds the period wins, so the achievement count moves down here.
    context.fillText(
      `${messages.profileCard.achievements(format(input.achievementsUnlocked))} · ${messages.profileCard.mode(input.mode)}`,
      920 * ui,
      428 * ui,
    );
    context.textAlign = "left";
  },
};

/** The background fills the card; stats sit on a dark glass panel with a win-rate ring. */
const immersiveLayout: CardLayout = {
  name: "Immersive",
  height: 476,
  draw: (card) => {
    const { context, input, accent, format } = card;
    drawTierBackground(card, 476);
    const shade = context.createLinearGradient(0, 0, CARD_WIDTH * ui, 0);
    shade.addColorStop(0, "#05081ad0");
    shade.addColorStop(0.45, "#05081a90");
    shade.addColorStop(1, "#05081a40");
    context.fillStyle = shade;
    context.fillRect(0, 0, CARD_WIDTH * ui, 476 * ui);

    drawAvatar(card, 98, 104, 58);
    drawName(card, 40, 222, 330);
    drawTierLine(card, 40, 240);
    if (hasPeriodWins(input)) {
      drawMedals(card, 40, 300, 22, 330);
      drawPeriodWins(card, 40, 312, 330, [54, 304]);
    } else {
      drawMedals(card, 40, 340, 22, 330);
    }
    context.fillStyle = "#cbd5e1";
    context.font = font(14);
    context.fillText(
      messages.profileCard.achievements(format(input.achievementsUnlocked)),
      40 * ui,
      412 * ui,
    );
    drawCaption(card, messages.profileCard.mode(input.mode), 40, 424, "left");

    roundRect(context, 392, 32, 536, 412, 20);
    context.fillStyle = "#070b1ccc";
    context.fill();
    context.strokeStyle = "#ffffff1f";
    context.lineWidth = ui;
    context.stroke();

    // Win-rate ring.
    const cx = 476;
    const cy = 154;
    const rate = winRate(input);
    context.lineCap = "round";
    context.lineWidth = 10 * ui;
    context.strokeStyle = "#ffffff14";
    context.beginPath();
    context.arc(cx * ui, cy * ui, 54 * ui, 0, Math.PI * 2);
    context.stroke();
    context.save();
    context.shadowColor = accent;
    context.shadowBlur = 10 * ui;
    context.strokeStyle = accent;
    context.beginPath();
    context.arc(cx * ui, cy * ui, 54 * ui, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rate);
    context.stroke();
    context.restore();
    context.textAlign = "center";
    context.fillStyle = "#f8fafc";
    context.font = font(26, "bold");
    context.fillText(card.percent(rate), cx * ui, (cy + 6) * ui);
    context.fillStyle = "#94a3b8";
    context.font = font(11);
    context.fillText(
      `${format(input.wins)} / ${format(input.participated)}`,
      cx * ui,
      (cy + 24) * ui,
    );
    context.fillText(messages.profileCard.winRate, cx * ui, (cy + 82) * ui);
    context.textAlign = "left";

    context.fillStyle = "#94a3b8";
    context.font = font(13, "bold");
    context.fillText(
      messages.profileCard.points.toLocaleUpperCase(messages.locale),
      572 * ui,
      120 * ui,
    );
    context.fillStyle = "#f8fafc";
    context.font = font(46, "bold");
    context.fillText(format(input.points), 570 * ui, 170 * ui);
    drawProgress(card, 572, 200, 332);

    // The ring already shows wins, so three wide tiles keep every label whole.
    const tileWidth = (536 - 48 - 24) / 3;
    const tiles: Array<[string, string, StatIcon]> = [
      [format(input.gamesStarted), messages.profileCard.gamesStarted, "started"],
      [format(input.guesses), messages.profileCard.guesses, "guesses"],
      [`${input.gmMultiplier.toFixed(2)}x`, messages.profileCard.multiplier, "multiplier"],
    ];
    tiles.forEach(([value, label, icon], index) =>
      drawTile(card, [416 + index * (tileWidth + 12), 316, tileWidth, 100], value, label, icon, 22),
    );
  },
};

/** A tall banner, then one row of headline numbers and a medal podium. */
const heroLayout: CardLayout = {
  name: "Hero",
  height: 470,
  draw: (card) => {
    const { context, input, format } = card;
    context.fillStyle = "#0b1120";
    context.fillRect(0, 0, CARD_WIDTH * ui, 470 * ui);
    drawTierBackground(card, 236);
    context.fillStyle = "#ffffff1a";
    context.fillRect(0, 236 * ui, CARD_WIDTH * ui, ui);
    drawAvatar(card, 112, 118, 70);
    drawName(card, 210, 112, 400);
    drawTierLine(card, 212, 130);
    drawCaption(card, messages.profileCard.mode(input.mode), 212, 172, "left");

    const columns: Array<[string, string]> = [
      [format(input.points), messages.profileCard.points],
      [`${format(input.wins)} / ${format(input.participated)}`, messages.profileCard.wins],
      [card.percent(winRate(input)), messages.profileCard.winRate],
      [format(input.gamesStarted), messages.profileCard.gamesStarted],
      [format(input.guesses), messages.profileCard.guesses],
      [`${input.gmMultiplier.toFixed(2)}x`, messages.profileCard.multiplier],
    ];
    const columnWidth = 880 / columns.length;
    columns.forEach(([value, label], index) => {
      const x = 40 + index * columnWidth;
      if (index > 0) {
        context.fillStyle = "#ffffff1a";
        context.fillRect(x * ui, 264 * ui, ui, 58 * ui);
      }
      context.textAlign = "center";
      context.fillStyle = "#f8fafc";
      setFittingFont(context, value, index === 0 ? 28 : 22, "bold", (columnWidth - 12) * ui);
      context.fillText(value, (x + columnWidth / 2) * ui, 296 * ui);
      context.fillStyle = "#94a3b8";
      context.font = font(11);
      context.fillText(
        fitText(context, label, (columnWidth - 12) * ui),
        (x + columnWidth / 2) * ui,
        318 * ui,
      );
      context.textAlign = "left";
    });

    // Medal podium: bar heights follow the counts.
    const podium = [
      { rank: 2, count: input.medals.silver, color: "#cbd5e1" },
      { rank: 1, count: input.medals.gold, color: "#fbbf24" },
      { rank: 3, count: input.medals.bronze, color: "#c08457" },
    ];
    const most = Math.max(1, ...podium.map((step) => step.count));
    podium.forEach(({ rank, count, color }, index) => {
      const x = 40 + index * 82;
      const height = 18 + (count / most) * 56;
      const top = 440 - height;
      const bar = context.createLinearGradient(0, top * ui, 0, 440 * ui);
      bar.addColorStop(0, color);
      bar.addColorStop(1, `${color}33`);
      roundRect(context, x, top, 66, height, 8);
      context.fillStyle = bar;
      context.fill();
      drawMedalIcon(context, (x + 19) * ui, (top - 6) * ui, rank, color);
      context.textAlign = "center";
      context.fillStyle = "#0b1120";
      context.font = font(16, "bold");
      context.fillText(format(count), (x + 33) * ui, (top + 24) * ui);
      context.textAlign = "left";
    });
    context.fillStyle = "#cbd5e1";
    context.font = font(15);
    if (hasPeriodWins(input)) {
      drawPeriodWins(card, 300, 326, 240);
      context.fillText(
        messages.profileCard.achievements(format(input.achievementsUnlocked)),
        300 * ui,
        432 * ui,
      );
    } else {
      context.fillText(
        messages.profileCard.medalPoints(format(playerMedalPoints(input.medals))),
        300 * ui,
        376 * ui,
      );
      context.fillText(
        messages.profileCard.achievements(format(input.achievementsUnlocked)),
        300 * ui,
        402 * ui,
      );
    }
    drawProgress(card, 560, 384, 360);
  },
};

export const PROFILE_CARD_LAYOUTS = {
  banner: bannerLayout,
  immersive: immersiveLayout,
  hero: heroLayout,
} satisfies Record<string, CardLayout>;

export type ProfileCardLayout = keyof typeof PROFILE_CARD_LAYOUTS;

export const activeProfileCardLayout: ProfileCardLayout = "banner";

export const renderProfileCard = (
  input: ProfileCardInput,
  layoutName: ProfileCardLayout = activeProfileCardLayout,
  tileStyle: ProfileTileStyle = activeProfileTileStyle,
) => {
  const layout = PROFILE_CARD_LAYOUTS[layoutName];
  const height = layout.height;
  const canvas = createCanvas(CARD_WIDTH * ui, height * ui);
  const context = canvas.getContext("2d");
  const numberFormat = new Intl.NumberFormat(messages.locale);
  const nameStyle = getPlayerMapNameStyle(input.medals, getPlayerMapHeaderDesign(input.medals));
  // Rounded corners: Discord shows the transparent edges as the chat background.
  roundRect(context, 0, 0, CARD_WIDTH, height, 22);
  context.clip();
  layout.draw({
    context,
    input,
    nameStyle,
    accent: nameStyle.color,
    format: (value) => numberFormat.format(value),
    percent: (ratio) =>
      new Intl.NumberFormat(messages.locale, { style: "percent", maximumFractionDigits: 0 }).format(
        ratio,
      ),
    tileStyle,
  });
  return { buffer: canvas.toBuffer("image/png"), filename: `profile-${input.mode}.png` };
};
