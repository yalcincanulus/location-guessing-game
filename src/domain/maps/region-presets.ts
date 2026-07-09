export type MapViewport = {
  name: string;
  width: number;
  height: number;
  scale: number;
  translate: [number, number];
  center: [number, number];
};

/** Pixel density multiplier. Scale, translate, width, and height all grow together so framing stays the same. */
export const MAP_RESOLUTION_SCALE = 2;

type BaseMapViewport = MapViewport;

const scaleViewport = (base: BaseMapViewport): MapViewport => ({
  name: base.name,
  width: Math.round(base.width * MAP_RESOLUTION_SCALE),
  height: Math.round(base.height * MAP_RESOLUTION_SCALE),
  scale: base.scale * MAP_RESOLUTION_SCALE,
  translate: [base.translate[0] * MAP_RESOLUTION_SCALE, base.translate[1] * MAP_RESOLUTION_SCALE],
  center: base.center,
});

const baseMapViewports: Record<string, BaseMapViewport> = {
  world: {
    name: "world",
    width: 1400,
    height: 950,
    scale: 220,
    translate: [700, 590],
    center: [0, 0],
  },
  europe: {
    name: "europe",
    width: 900,
    height: 700,
    scale: 520,
    translate: [450, 430],
    center: [15, 53],
  },
  asia: {
    name: "asia",
    width: 1000,
    height: 700,
    scale: 360,
    translate: [500, 390],
    center: [85, 35],
  },
  southeastasia: {
    name: "southeastasia",
    width: 900,
    height: 750,
    scale: 700,
    translate: [450, 400],
    center: [115, 5],
  },
  africa: {
    name: "africa",
    width: 850,
    height: 750,
    scale: 420,
    translate: [425, 360],
    center: [20, 0],
  },
  northamerica: {
    name: "northamerica",
    width: 900,
    height: 700,
    scale: 360,
    translate: [450, 390],
    center: [-100, 48],
  },
  southamerica: {
    name: "southamerica",
    width: 700,
    height: 850,
    scale: 420,
    translate: [350, 310],
    center: [-60, -20],
  },
  oceania: {
    name: "oceania",
    width: 850,
    height: 650,
    scale: 430,
    translate: [420, 360],
    center: [140, -25],
  },
};

export const mapViewports: Record<string, MapViewport> = Object.fromEntries(
  Object.entries(baseMapViewports).map(([key, viewport]) => [key, scaleViewport(viewport)]),
);

export const viewportAliases = new Map<string, string>([
  ["map", "world"],
  ["harita", "world"],
  ["world", "world"],
  ["europe", "europe"],
  ["avrupa", "europe"],
  ["asia", "asia"],
  ["asya", "asia"],
  ["southeastasia", "southeastasia"],
  ["seasia", "southeastasia"],
  ["guneydoguasya", "southeastasia"],
  ["güneydoğuasya", "southeastasia"],
  ["africa", "africa"],
  ["afrika", "africa"],
  ["northamerica", "northamerica"],
  ["kuzeyamerika", "northamerica"],
  ["southamerica", "southamerica"],
  ["guneyamerika", "southamerica"],
  ["güneyamerika", "southamerica"],
  ["oceania", "oceania"],
  ["okyanusya", "oceania"],
]);
