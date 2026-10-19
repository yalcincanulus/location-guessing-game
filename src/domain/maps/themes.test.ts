import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, test } from "bun:test";
import { renderMap } from "./map-renderer.ts";
import {
  DEFAULT_MAP_THEME,
  fillBaseColor,
  findMapThemeName,
  MAP_THEME_NAMES,
  MAP_THEMES,
  memorialMapTheme,
  resolveMapTheme,
} from "./themes.ts";

describe("map themes", () => {
  test("finds a theme by id or by its name in either language", () => {
    expect(findMapThemeName("parchment")).toBe("parchment");
    expect(findMapThemeName("Parşömen")).toBe("parchment");
    expect(findMapThemeName("renk körü dostu")).toBe("accessible");
    expect(findMapThemeName("Colour-Blind Friendly")).toBe("accessible");
    expect(findMapThemeName("MAVİ KOPYA")).toBe("blueprint");
    expect(findMapThemeName("nope")).toBeUndefined();
  });

  test("10 November beats the selected theme, and unknown ids use the default", () => {
    expect(resolveMapTheme({ theme: "neon", mourning: true })).toBe(memorialMapTheme);
    expect(resolveMapTheme({ theme: "removed-theme" as never })).toBe(
      MAP_THEMES[DEFAULT_MAP_THEME],
    );
    expect(resolveMapTheme({})).toBe(MAP_THEMES[DEFAULT_MAP_THEME]);
  });

  test("every theme tells wrong guesses, the answer and land apart", () => {
    for (const name of MAP_THEME_NAMES) {
      const theme = MAP_THEMES[name];
      // A pattern may share its base colour with land; the ink still sets it apart.
      const fills = [theme.wrong, theme.correct, theme.country].map((fill) => JSON.stringify(fill));
      expect(new Set(fills).size, name).toBe(3);
      expect(theme.names.tr && theme.names.en && theme.descriptions.tr, name).toBeTruthy();
    }
  });

  test("every theme renders the answer in its own colour", async () => {
    for (const name of MAP_THEME_NAMES) {
      const map = renderMap({
        wrongCountries: ["GR"],
        correctCountry: "TR",
        marker: { latitude: 39.92, longitude: 32.85 },
        theme: name,
      });
      const image = await loadImage(map.buffer);
      const canvas = createCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      // Central Anatolia, clear of the marker and crosshair.
      const [r, g, b] = context.getImageData(
        image.width / 2 + 120,
        image.height / 2 + 120,
        1,
        1,
      ).data;
      const hex = `#${[r, g, b].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`;
      expect(hex, name).toBe(fillBaseColor(MAP_THEMES[name].correct));
    }
  });
});
