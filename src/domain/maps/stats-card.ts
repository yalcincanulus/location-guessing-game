import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  geoGraticule10,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { messages } from "../../i18n/messages.ts";
import type { ServerStats } from "../../repositories/server-stats-repository.ts";
import {
  getCountryDisplayName,
  getCountryNumericId,
} from "../countries/normalize-country-guess.ts";
import { getProvinceName } from "../provinces/normalize-province-guess.ts";
import { provinceCollection, provinceFeatures } from "../provinces/province-geometry.ts";
import { getLocationCentroid } from "./location-centroids.ts";
import { countryFeatures } from "./map-renderer.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

/**
 * The `!stats` card. Unlike the profile card, the context is scaled once, so every
 * coordinate and font size here is in card units.
 */
const ui = MAP_RESOLUTION_SCALE;
const FONT = '"DejaVu Sans", Arial, sans-serif';
const CARD_WIDTH = 960;
const DAY_MS = 86_400_000;

const TEXT = "#f8fafc";
const MUTED = "#94a3b8";
const DIM = "#64748b";
const GOLD = "#fbbf24";
const PANEL = "#0b1222b8";
const PANEL_EDGE = "#ffffff14";
/** Dim amber to pale gold, for map heat and chart bars. */
const HEAT_RAMP = ["#7c2d12", "#d97706", "#fbbf24", "#fef3c7"];

type Ctx = SKRSContext2D;
type Rect = { x: number; y: number; w: number; h: number };

type StatsCardContext = {
  context: Ctx;
  stats: ServerStats;
  now: Date;
  format: (value: number) => string;
  decimal: (value: number) => string;
};

type StatsCardLayout = { name: string; height: number; draw: (card: StatsCardContext) => void };

const font = (size: number, weight = "") => `${weight} ${size}px ${FONT}`.trim();

const fitText = (context: Ctx, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  while (characters.length > 1 && context.measureText(`${characters.join("")}…`).width > maxWidth) {
    characters.pop();
  }
  return `${characters.join("")}…`;
};

/** Numbers stay whole: they shrink to fit instead of losing digits. */
const setFittingFont = (
  context: Ctx,
  text: string,
  size: number,
  weight: string,
  maxWidth: number,
) => {
  context.font = font(size, weight);
  const width = context.measureText(text).width;
  if (width > maxWidth) context.font = font(Math.floor((size * maxWidth) / width), weight);
};

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

/** A colour `t` (0 to 1) of the way along `ramp`. */
const rampColor = (t: number, ramp = HEAT_RAMP) => {
  const scaled = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(scaled));
  const from = hexToRgb(ramp[index]!);
  const to = hexToRgb(ramp[index + 1]!);
  const local = scaled - index;
  const channel = (offset: 0 | 1 | 2) =>
    Math.round(from[offset] + (to[offset] - from[offset]) * local);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
};

const panel = (context: Ctx, { x, y, w, h }: Rect, radius = 14, fill = PANEL) => {
  context.save();
  context.beginPath();
  context.roundRect(x, y, w, h, radius);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = PANEL_EDGE;
  context.lineWidth = 1;
  context.stroke();
  context.restore();
};

const sectionTitle = (context: Ctx, text: string, x: number, y: number) => {
  context.save();
  context.fillStyle = MUTED;
  context.font = font(11, "bold");
  context.fillText(text.toLocaleUpperCase(messages.locale), x, y);
  context.restore();
};

const locationName = (stats: ServerStats, code: string) =>
  stats.mode === "province" ? getProvinceName(code) : getCountryDisplayName(code, messages.locale);

/** Whole days since the first game, counting the first day. */
const activeDays = (stats: ServerStats, now: Date) =>
  stats.firstGameAt
    ? Math.max(1, Math.floor((now.getTime() - stats.firstGameAt.getTime()) / DAY_MS) + 1)
    : 0;

const perGame = (card: StatsCardContext, value: number) =>
  card.stats.completedGames === 0 ? "0" : card.decimal(value / card.stats.completedGames);

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random numbers, so the same stats always draw the same stars. */
const seededRandom = (seed: number) => () => {
  seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return seed / 4_294_967_296;
};

/** Night sky: navy gradient, two aurora glows and a field of faint stars. */
const drawNightSky = (context: Ctx, width: number, height: number) => {
  const base = context.createLinearGradient(0, 0, width * 0.4, height);
  base.addColorStop(0, "#0b1024");
  base.addColorStop(0.55, "#070b18");
  base.addColorStop(1, "#05070f");
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  for (const [x, y, radius, color] of [
    [0.85, 0.05, 0.6, "#4f46e533"],
    [0.1, 0.95, 0.5, "#0ea5e926"],
    [0.45, 0.4, 0.35, "#f59e0b12"],
  ] as const) {
    const glow = context.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      width * radius,
    );
    glow.addColorStop(0, color);
    glow.addColorStop(1, `${color.slice(0, 7)}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }
  const random = seededRandom(7);
  for (let index = 0; index < 260; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = random() < 0.92 ? 0.6 : 1.3;
    context.fillStyle = `rgba(226, 232, 240, ${(0.15 + random() * 0.5).toFixed(2)})`;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
};

type MapStyle = "flat" | "globe";

/** ISO numeric id of Antarctica, left off flat maps where it would fill the bottom edge. */
const ANTARCTICA_ID = "010";

/**
 * Every country (or province) tinted by how often it was a game's answer, on a log scale so a
 * few favourites do not wash out the rest. Locations too small to see get a glowing dot.
 */
const drawHeatMap = (card: StatsCardContext, rect: Rect, style: MapStyle) => {
  const { context, stats } = card;
  const max = Math.max(1, ...stats.locations.map((entry) => entry.count));
  const heat = (count: number) => Math.log1p(count) / Math.log1p(max);
  const extent: [[number, number], [number, number]] = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
  ];

  let projection: GeoProjection;
  let features: Array<{ id: string; feature: unknown }>;
  let countByFeature: Map<string, number>;
  if (stats.mode === "province") {
    projection = geoMercator().fitExtent(extent, provinceCollection as never);
    features = provinceFeatures.map((entry) => ({ id: entry.id, feature: entry }));
    countByFeature = new Map(stats.locations.map((entry) => [entry.code, entry.count]));
  } else {
    projection =
      style === "globe"
        ? geoOrthographic().rotate([-28, -22]).fitExtent(extent, { type: "Sphere" })
        : geoNaturalEarth1().fitExtent(extent, { type: "Sphere" });
    features = countryFeatures
      .map((entry) => ({ id: String(entry.id).padStart(3, "0"), feature: entry }))
      .filter((entry) => style === "globe" || entry.id !== ANTARCTICA_ID);
    countByFeature = new Map(
      stats.locations.flatMap((entry) => {
        const id = getCountryNumericId(entry.code);
        return id ? [[id, entry.count] as const] : [];
      }),
    );
  }
  const path = geoPath(projection, context);

  context.save();
  if (style === "globe" && stats.mode !== "province") {
    const [cx, cy] = projection.translate();
    const radius = projection.scale();
    // Atmosphere halo, then the ocean sphere lit from the upper left.
    const halo = context.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.25);
    halo.addColorStop(0, "#38bdf855");
    halo.addColorStop(1, "#38bdf800");
    context.fillStyle = halo;
    context.fillRect(cx - radius * 1.3, cy - radius * 1.3, radius * 2.6, radius * 2.6);
    const ocean = context.createRadialGradient(
      cx - radius * 0.4,
      cy - radius * 0.45,
      radius * 0.1,
      cx,
      cy,
      radius,
    );
    ocean.addColorStop(0, "#1e3a5f");
    ocean.addColorStop(1, "#060d1d");
    context.beginPath();
    path({ type: "Sphere" } as never);
    context.fillStyle = ocean;
    context.fill();
    context.beginPath();
    path(geoGraticule10() as never);
    context.strokeStyle = "#38bdf814";
    context.lineWidth = 0.6;
    context.stroke();
  } else if (stats.mode !== "province") {
    context.beginPath();
    path(geoGraticule10() as never);
    context.strokeStyle = "#94a3b80d";
    context.lineWidth = 0.6;
    context.stroke();
  }

  for (const { id, feature } of features) {
    const count = countByFeature.get(id);
    context.beginPath();
    path(feature as never);
    context.fillStyle = count ? rampColor(heat(count)) : "#1a2540";
    context.fill();
    context.strokeStyle = count ? "#0b122299" : "#2a3858";
    context.lineWidth = stats.mode === "province" ? 0.7 : 0.4;
    context.stroke();
  }

  // Glow on the most played locations, drawn on top so neighbours do not cover it.
  context.save();
  context.shadowColor = GOLD;
  context.shadowBlur = 12;
  for (const { id, feature } of features) {
    const count = countByFeature.get(id);
    if (!count || heat(count) < 0.75) continue;
    context.beginPath();
    path(feature as never);
    context.fillStyle = rampColor(heat(count));
    context.fill();
  }
  context.restore();

  for (const entry of stats.locations) {
    const id = stats.mode === "province" ? entry.code : getCountryNumericId(entry.code);
    const feature = features.find((candidate) => candidate.id === id)?.feature;
    if (feature && path.area(feature as never) > 12) continue;
    const centroid = getLocationCentroid(stats.mode, entry.code);
    const point = centroid && projection(centroid);
    if (!point || (style === "globe" && !path({ type: "Point", coordinates: centroid } as never)))
      continue;
    context.save();
    context.shadowColor = GOLD;
    context.shadowBlur = 6;
    context.fillStyle = rampColor(heat(entry.count));
    context.beginPath();
    context.arc(point[0], point[1], 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();
};

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const drawTitle = (card: StatsCardContext, x: number, y: number, size = 30) => {
  const { context, stats } = card;
  context.save();
  context.fillStyle = TEXT;
  context.font = font(size, "bold");
  context.shadowColor = "#000000aa";
  context.shadowBlur = 8;
  context.fillText(messages.statsCard.title, x, y);
  context.shadowBlur = 0;
  // Mode chip under the title.
  const label = messages.profileCard.mode(stats.mode).toLocaleUpperCase(messages.locale);
  context.font = font(11, "bold");
  const chipWidth = context.measureText(label).width + 20;
  context.beginPath();
  context.roundRect(x, y + 12, chipWidth, 22, 11);
  context.fillStyle = `${GOLD}26`;
  context.fill();
  context.strokeStyle = `${GOLD}aa`;
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = GOLD;
  context.textBaseline = "middle";
  context.fillText(label, x + 10, y + 23.5);
  context.restore();
};

/** "93 days active", "since 7 July 2026" below; `align` says where `x` is. */
const drawActiveBadge = (
  card: StatsCardContext,
  x: number,
  y: number,
  align: "left" | "center" | "right",
  size = 44,
) => {
  const { context, stats, now, format } = card;
  const days = activeDays(stats, now);
  context.save();
  context.textAlign = align;
  context.shadowColor = "#000000aa";
  context.shadowBlur = 8;
  if (!stats.firstGameAt) {
    context.fillStyle = MUTED;
    context.font = font(18, "bold");
    context.fillText(messages.statsCard.noGamesYet, x, y);
    context.restore();
    return;
  }
  const number = format(days);
  const label = messages.statsCard.daysActive;
  context.font = font(size, "bold");
  const numberWidth = context.measureText(number).width;
  context.font = font(size * 0.36, "bold");
  const labelWidth = context.measureText(label).width;
  const total = numberWidth + 8 + labelWidth;
  const left = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  context.textAlign = "left";
  const fill = context.createLinearGradient(left, y - size, left, y);
  fill.addColorStop(0, "#fef3c7");
  fill.addColorStop(1, GOLD);
  context.fillStyle = fill;
  context.font = font(size, "bold");
  context.fillText(number, left, y);
  context.fillStyle = TEXT;
  context.font = font(size * 0.36, "bold");
  context.fillText(label, left + numberWidth + 8, y);
  context.textAlign = align;
  context.fillStyle = MUTED;
  context.font = font(13);
  context.fillText(messages.statsCard.activeSince(stats.firstGameAt), x, y + 22);
  context.restore();
};

/** Big number tile: value on top, label below. */
const drawTile = (
  card: StatsCardContext,
  rect: Rect,
  value: string,
  label: string,
  options: { size?: number; accent?: boolean; fill?: string } = {},
) => {
  const { context } = card;
  const size = options.size ?? 28;
  panel(context, rect, 14, options.fill);
  context.save();
  if (options.accent) {
    const fill = context.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
    fill.addColorStop(0, "#fef3c7");
    fill.addColorStop(1, GOLD);
    context.fillStyle = fill;
  } else {
    context.fillStyle = TEXT;
  }
  setFittingFont(context, value, size, "bold", rect.w - 32);
  context.fillText(value, rect.x + 16, rect.y + rect.h / 2 + size * 0.2);
  context.fillStyle = MUTED;
  context.font = font(12);
  context.fillText(
    fitText(context, label, rect.w - 32),
    rect.x + 16,
    rect.y + rect.h / 2 + size * 0.2 + 20,
  );
  context.restore();
};

/** Compact "label ......... value" row for secondary numbers. */
const drawFactRow = (
  card: StatsCardContext,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) => {
  const { context } = card;
  context.save();
  context.font = font(15, "bold");
  const valueText = fitText(context, value, width * 0.55);
  const valueWidth = context.measureText(valueText).width;
  context.fillStyle = TEXT;
  context.textAlign = "right";
  context.fillText(valueText, x + width, y);
  context.textAlign = "left";
  context.fillStyle = MUTED;
  context.font = font(13);
  context.fillText(fitText(context, label, width - valueWidth - 14), x, y);
  context.restore();
};

/** Ranked list with a heat bar behind each row. */
const drawTopLocations = (card: StatsCardContext, rect: Rect, limit = 5, withPanel = true) => {
  const { context, stats, format } = card;
  if (withPanel) panel(context, rect);
  sectionTitle(context, messages.statsCard.topLocations(stats.mode), rect.x + 16, rect.y + 26);
  const items = stats.locations.slice(0, limit);
  const max = Math.max(1, items[0]?.count ?? 1);
  const top = rect.y + 42;
  const rowHeight = Math.min(34, (rect.h - 52) / Math.max(1, limit));
  context.save();
  items.forEach((entry, index) => {
    const y = top + index * rowHeight;
    const barWidth = Math.max(6, (rect.w - 32) * (entry.count / max));
    context.beginPath();
    context.roundRect(rect.x + 16, y, barWidth, rowHeight - 8, 6);
    const bar = context.createLinearGradient(rect.x + 16, 0, rect.x + 16 + barWidth, 0);
    bar.addColorStop(0, `${GOLD}10`);
    bar.addColorStop(1, `${GOLD}${index === 0 ? "55" : "30"}`);
    context.fillStyle = bar;
    context.fill();
    const middle = y + (rowHeight - 8) / 2 + 5;
    context.fillStyle = index === 0 ? GOLD : DIM;
    context.font = font(13, "bold");
    context.fillText(String(index + 1), rect.x + 26, middle);
    context.font = font(14, "bold");
    const countText = format(entry.count);
    const countWidth = context.measureText(countText).width;
    context.textAlign = "right";
    context.fillStyle = index === 0 ? GOLD : TEXT;
    context.fillText(countText, rect.x + rect.w - 26, middle);
    context.textAlign = "left";
    context.fillStyle = TEXT;
    context.font = font(14, index === 0 ? "bold" : "");
    context.fillText(
      fitText(context, locationName(stats, entry.code), rect.w - 84 - countWidth),
      rect.x + 46,
      middle,
    );
  });
  if (items.length === 0) {
    context.fillStyle = DIM;
    context.font = font(13);
    context.fillText("—", rect.x + 16, top + 16);
  }
  context.restore();
};

/** Games per month as bars, the current month highlighted. */
const drawMonthlyChart = (card: StatsCardContext, rect: Rect, withPanel = true) => {
  const { context, stats, format } = card;
  if (withPanel) panel(context, rect);
  sectionTitle(context, messages.statsCard.monthlyGames, rect.x + 16, rect.y + 26);
  // Twelve bars at most: older months still count toward the totals elsewhere.
  const months = stats.monthly.slice(-12);
  if (months.length === 0) return;
  const max = Math.max(1, ...months.map((entry) => entry.games));
  const chart = { x: rect.x + 16, y: rect.y + 52, w: rect.w - 32, h: rect.h - 86 };
  const slot = chart.w / months.length;
  const barWidth = Math.min(46, slot * 0.68);
  context.save();
  months.forEach((entry, index) => {
    const cx = chart.x + slot * index + slot / 2;
    const height = Math.max(3, (chart.h - 16) * (entry.games / max));
    const top = chart.y + chart.h - height;
    const last = index === months.length - 1;
    const bar = context.createLinearGradient(0, top, 0, chart.y + chart.h);
    bar.addColorStop(0, last ? "#fef3c7" : rampColor(0.35 + 0.65 * (entry.games / max)));
    bar.addColorStop(1, last ? `${GOLD}66` : "#7c2d1244");
    context.beginPath();
    context.roundRect(cx - barWidth / 2, top, barWidth, height, [5, 5, 2, 2]);
    context.fillStyle = bar;
    if (last) {
      context.shadowColor = GOLD;
      context.shadowBlur = 10;
    }
    context.fill();
    context.shadowBlur = 0;
    context.textAlign = "center";
    if (entry.games > 0) {
      context.fillStyle = last ? GOLD : "#cbd5e1";
      context.font = font(11, "bold");
      context.fillText(format(entry.games), cx, top - 6);
    }
    context.fillStyle = last ? TEXT : DIM;
    context.font = font(11, last ? "bold" : "");
    context.fillText(messages.statsCard.monthLabel(entry.month), cx, chart.y + chart.h + 18);
  });
  context.restore();
};

/** Games by start hour: 24 thin bars with 00 / 06 / 12 / 18 ticks. */
const drawHourlyChart = (card: StatsCardContext, rect: Rect, withPanel = true) => {
  const { context, stats } = card;
  if (withPanel) panel(context, rect);
  sectionTitle(context, messages.statsCard.hourlyGames, rect.x + 16, rect.y + 26);
  const max = Math.max(1, ...stats.hourly);
  const peak = stats.hourly.indexOf(max);
  if (stats.hourly.some((games) => games > 0)) {
    context.save();
    context.fillStyle = GOLD;
    context.font = font(11, "bold");
    context.textAlign = "right";
    context.fillText(
      messages.statsCard.peakHour(`${String(peak).padStart(2, "0")}:00`),
      rect.x + rect.w - 16,
      rect.y + 26,
    );
    context.restore();
  }
  const chart = { x: rect.x + 16, y: rect.y + 44, w: rect.w - 32, h: rect.h - 76 };
  const slot = chart.w / 24;
  context.save();
  stats.hourly.forEach((games, hour) => {
    const height = Math.max(2, chart.h * (games / max));
    const x = chart.x + slot * hour + slot * 0.15;
    context.beginPath();
    context.roundRect(x, chart.y + chart.h - height, slot * 0.7, height, 2);
    context.fillStyle =
      games === 0 ? "#ffffff10" : hour === peak ? GOLD : rampColor(0.2 + 0.6 * (games / max));
    context.fill();
  });
  context.fillStyle = DIM;
  context.font = font(10);
  context.textAlign = "center";
  for (const hour of [0, 6, 12, 18]) {
    context.fillText(
      String(hour).padStart(2, "0"),
      chart.x + slot * hour + slot / 2,
      chart.y + chart.h + 16,
    );
  }
  context.restore();
};

/** Secondary numbers shared by every layout. */
const factRows = (card: StatsCardContext): Array<[string, string]> => {
  const { stats, format } = card;
  const copy = messages.statsCard;
  const rows: Array<[string, string]> = [
    [copy.guessesPerGame, perGame(card, stats.totalGuesses)],
    [copy.playersPerGame, perGame(card, stats.participations)],
    [copy.oneshotGames, format(stats.oneshotGames)],
    [copy.hosts, format(stats.hosts)],
    [copy.longestGame, copy.guessCount(format(stats.hardestGameGuesses))],
  ];
  if (stats.busiestDay) {
    rows.push([
      copy.busiestDay,
      `${copy.dayLabel(stats.busiestDay.date)} · ${format(stats.busiestDay.games)}`,
    ]);
  }
  if (stats.mostWrongGuess) {
    rows.push([
      copy.mostWrongGuess,
      `${locationName(stats, stats.mostWrongGuess.code)} (${format(stats.mostWrongGuess.count)})`,
    ]);
  }
  rows.push([copy.pointsAwarded, format(stats.pointsAwarded)]);
  rows.push([copy.achievements, format(stats.achievementsUnlocked)]);
  return rows;
};

const drawFacts = (card: StatsCardContext, rect: Rect, rows = factRows(card), withPanel = true) => {
  if (withPanel) panel(card.context, rect);
  const rowHeight = (rect.h - 24) / rows.length;
  rows.forEach(([label, value], index) => {
    const y = rect.y + 12 + rowHeight * index + rowHeight / 2 + 5;
    drawFactRow(card, rect.x + 16, y, rect.w - 32, label, value);
    if (index < rows.length - 1) {
      card.context.fillStyle = "#ffffff0a";
      card.context.fillRect(rect.x + 16, rect.y + 12 + rowHeight * (index + 1), rect.w - 32, 1);
    }
  });
};

/** Crown and flag chips for the top winner and the top host. */
const drawHallOfFame = (card: StatsCardContext, rect: Rect) => {
  const { context, stats, format } = card;
  const entries = [
    [messages.statsCard.topWinner, stats.topWinner, GOLD],
    [messages.statsCard.topHost, stats.topHost, "#a78bfa"],
  ] as const;
  const gap = 12;
  const width = (rect.w - gap) / 2;
  entries.forEach(([label, entry, color], index) => {
    const x = rect.x + index * (width + gap);
    panel(context, { x, y: rect.y, w: width, h: rect.h });
    context.save();
    context.fillStyle = color;
    context.fillRect(x, rect.y + 12, 3, rect.h - 24);
    context.fillStyle = MUTED;
    context.font = font(11, "bold");
    context.fillText(label.toLocaleUpperCase(messages.locale), x + 16, rect.y + 22);
    const countText = entry ? messages.statsCard.gameCount(format(entry.count)) : "";
    context.font = font(13, "bold");
    const countWidth = context.measureText(countText).width;
    context.textAlign = "right";
    context.fillStyle = color;
    context.fillText(countText, x + width - 16, rect.y + rect.h - 16);
    context.textAlign = "left";
    context.fillStyle = TEXT;
    context.font = font(17, "bold");
    context.fillText(
      fitText(context, entry?.name ?? "—", width - 44 - countWidth),
      x + 16,
      rect.y + rect.h - 15,
    );
    context.restore();
  });
};

const drawFooter = (card: StatsCardContext, y: number) => {
  const { context, now } = card;
  context.save();
  context.fillStyle = "#475569";
  context.font = font(11);
  context.textAlign = "right";
  context.fillText(
    new Intl.DateTimeFormat(messages.locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    }).format(now),
    CARD_WIDTH - 24,
    y,
  );
  context.restore();
};

/** The four headline numbers. */
const headline = (card: StatsCardContext): Array<[string, string]> => {
  const { stats, format } = card;
  const copy = messages.statsCard;
  return [
    [format(stats.completedGames), copy.games],
    [format(stats.totalGuesses), copy.guesses],
    [format(stats.totalPlayers), copy.players],
    [format(stats.locations.length), copy.locations(stats.mode)],
  ];
};

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

/** A full-bleed heat map of every answer, with the numbers on glass over it. */
const atlasLayout: StatsCardLayout = {
  name: "Atlas",
  height: 830,
  draw: (card) => {
    const { context } = card;
    drawNightSky(context, CARD_WIDTH, 830);
    // Türkiye is wide and short, so it gets a frame clear of the list and the tiles.
    drawHeatMap(
      card,
      card.stats.mode === "province"
        ? { x: 24, y: 120, w: 650, h: 260 }
        : { x: -10, y: 70, w: 740, h: 380 },
      "flat",
    );
    // Fade the map into the stat area below.
    const fade = context.createLinearGradient(0, 360, 0, 470);
    fade.addColorStop(0, "#05070f00");
    fade.addColorStop(1, "#05070f");
    context.fillStyle = fade;
    context.fillRect(0, 360, CARD_WIDTH, 110);
    context.fillStyle = "#05070f";
    context.fillRect(0, 470, CARD_WIDTH, 360);

    drawTitle(card, 32, 52);
    drawActiveBadge(card, CARD_WIDTH - 32, 58, "right", 40);
    drawTopLocations(card, { x: 700, y: 108, w: 228, h: 222 });

    headline(card).forEach(([value, label], index) => {
      drawTile(card, { x: 32 + index * 228, y: 396, w: 212, h: 84 }, value, label, {
        accent: index === 0,
        fill: "#0f172acc",
      });
    });
    drawFacts(card, { x: 32, y: 496, w: 440, h: 304 });
    drawHourlyChart(card, { x: 488, y: 496, w: 440, h: 304 });
    drawFooter(card, 820);
  },
};

/** A banner with the active-day count, then tiles, lists and both activity charts. */
const dashboardLayout: StatsCardLayout = {
  name: "Dashboard",
  height: 820,
  draw: (card) => {
    const { context } = card;
    context.fillStyle = "#070b18";
    context.fillRect(0, 0, CARD_WIDTH, 820);
    drawNightSky(context, CARD_WIDTH, 190);
    // A globe rising from the banner's right edge.
    context.save();
    context.beginPath();
    context.rect(0, 0, CARD_WIDTH, 190);
    context.clip();
    drawHeatMap(card, { x: 560, y: 20, w: 460, h: 460 }, "globe");
    context.restore();
    const fade = context.createLinearGradient(0, 120, 0, 190);
    fade.addColorStop(0, "#070b1800");
    fade.addColorStop(1, "#070b18");
    context.fillStyle = fade;
    context.fillRect(0, 120, CARD_WIDTH, 70);
    const side = context.createLinearGradient(380, 0, 700, 0);
    side.addColorStop(0, "#070b18ee");
    side.addColorStop(1, "#070b1800");
    context.fillStyle = side;
    context.fillRect(0, 0, 700, 190);

    drawTitle(card, 32, 56);
    drawActiveBadge(card, 32, 150, "left", 46);

    headline(card).forEach(([value, label], index) => {
      drawTile(card, { x: 32 + index * 228, y: 206, w: 212, h: 88 }, value, label, {
        accent: index === 0,
      });
    });
    drawFacts(card, { x: 32, y: 310, w: 440, h: 270 });
    drawTopLocations(card, { x: 488, y: 310, w: 440, h: 196 });
    drawHallOfFame(card, { x: 488, y: 518, w: 440, h: 62 });
    drawMonthlyChart(card, { x: 32, y: 596, w: 576, h: 196 });
    drawHourlyChart(card, { x: 624, y: 596, w: 304, h: 196 });
    drawFooter(card, 810);
  },
};

/** A glowing globe (Türkiye for province games) beside the headline numbers; the timeline below. */
const globeLayout: StatsCardLayout = {
  name: "Globe",
  height: 760,
  draw: (card) => {
    const { context, stats } = card;
    drawNightSky(context, CARD_WIDTH, 760);
    const mapRect =
      stats.mode === "province"
        ? { x: 24, y: 200, w: 436, h: 200 }
        : { x: 40, y: 92, w: 380, h: 380 };
    drawHeatMap(card, mapRect, "globe");
    drawTitle(card, 32, 52);
    drawActiveBadge(card, 230, stats.mode === "province" ? 470 : 516, "center", 40);

    const tiles = headline(card);
    tiles.forEach(([value, label], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      drawTile(card, { x: 476 + column * 230, y: 40 + row * 100, w: 218, h: 88 }, value, label, {
        accent: index === 0,
        size: 32,
        fill: "#0b1222cc",
      });
    });
    drawTopLocations(card, { x: 476, y: 248, w: 448, h: 220 });
    drawHallOfFame(card, { x: 476, y: 480, w: 448, h: 62 });
    const rows = factRows(card);
    drawFacts(card, { x: 32, y: 556, w: 428, h: 180 }, rows.slice(0, 5));
    drawMonthlyChart(card, { x: 476, y: 556, w: 448, h: 180 });
    drawFooter(card, 752);
  },
};

export const STATS_CARD_LAYOUTS = {
  atlas: atlasLayout,
  dashboard: dashboardLayout,
  globe: globeLayout,
} satisfies Record<string, StatsCardLayout>;

export type StatsCardLayoutName = keyof typeof STATS_CARD_LAYOUTS;

export const activeStatsCardLayout: StatsCardLayoutName = "atlas";

export const renderStatsCard = (
  stats: ServerStats,
  layoutName: StatsCardLayoutName = activeStatsCardLayout,
  now = new Date(),
) => {
  const layout = STATS_CARD_LAYOUTS[layoutName];
  const canvas = createCanvas(CARD_WIDTH * ui, layout.height * ui);
  const context = canvas.getContext("2d");
  context.scale(ui, ui);
  // Rounded corners: Discord shows the transparent edges as the chat background.
  context.beginPath();
  context.roundRect(0, 0, CARD_WIDTH, layout.height, 22);
  context.clip();
  const numberFormat = new Intl.NumberFormat(messages.locale);
  const decimalFormat = new Intl.NumberFormat(messages.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  layout.draw({
    context,
    stats,
    now,
    format: (value) => numberFormat.format(value),
    decimal: (value) => decimalFormat.format(value),
  });
  return { buffer: canvas.toBuffer("image/png"), filename: `stats-${stats.mode}.png` };
};
