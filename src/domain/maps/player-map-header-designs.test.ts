import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  activePlayerMapHeaderDesigns,
  getPlayerMapHeaderDesign,
  getPlayerMapNameStyle,
  PLAYER_MAP_HEADER_DESIGNS,
  type PlayerMapHeaderDesign,
} from "./player-map-header-designs.ts";
import { MAP_HEADER_HEIGHT } from "./map-header.ts";
import { PLAYER_NAME_STYLES } from "./player-name-style.ts";
import { renderPlayerMap, type RenderPlayerMapOptions } from "./player-map-renderer.ts";

const designs = Object.keys(PLAYER_MAP_HEADER_DESIGNS).filter(
  (design) => design !== "plain",
) as PlayerMapHeaderDesign[];

const designsForTier = (tier: "explorer" | "legend" | "mythic") =>
  designs.filter((design) => PLAYER_MAP_HEADER_DESIGNS[design].tier === tier);

describe("player map headers", () => {
  test.each(designsForTier("explorer"))(
    "%s is available at 200 medal points and preserves the lower tiers",
    (design) => {
      expect(getPlayerMapHeaderDesign({ gold: 50, silver: 24, bronze: 1 }, design)).toBe("plain");
      expect(getPlayerMapHeaderDesign({ gold: 50, silver: 25, bronze: 0 }, design)).toBe(design);
      expect(getPlayerMapHeaderDesign({ gold: 0, silver: 0, bronze: 1000 }, design)).toBe(design);
    },
  );

  test.each(designsForTier("legend"))("%s is available at 500 medal points", (design) => {
    expect(getPlayerMapHeaderDesign({ gold: 50, silver: 24, bronze: 1 }, design)).toBe("plain");
    expect(getPlayerMapHeaderDesign({ gold: 133, silver: 49, bronze: 2 }, design)).toBe(
      activePlayerMapHeaderDesigns.explorer,
    );
    expect(getPlayerMapHeaderDesign({ gold: 100, silver: 100, bronze: 0 }, design)).toBe(design);
  });

  test.each(designsForTier("mythic"))("%s is available at 1000 medal points", (design) => {
    expect(getPlayerMapHeaderDesign({ gold: 50, silver: 24, bronze: 1 }, design)).toBe("plain");
    expect(getPlayerMapHeaderDesign({ gold: 333, silver: 0, bronze: 0 }, design)).toBe(
      activePlayerMapHeaderDesigns.legend,
    );
    expect(getPlayerMapHeaderDesign({ gold: 333, silver: 0, bronze: 1 }, design)).toBe(design);
  });

  test("mythic players may still preview lower tier designs", () => {
    const mythic = { gold: 400, silver: 0, bronze: 0 };
    expect(getPlayerMapHeaderDesign(mythic, "passport")).toBe("passport");
    expect(getPlayerMapHeaderDesign(mythic, "starAtlasObservatory")).toBe("starAtlasObservatory");
  });

  test("uses the selected design for each tier when no preview override is supplied", () => {
    expect(getPlayerMapHeaderDesign({ gold: 70, silver: 0, bronze: 0 })).toBe(
      activePlayerMapHeaderDesigns.explorer,
    );
    expect(getPlayerMapHeaderDesign({ gold: 167, silver: 0, bronze: 0 })).toBe(
      activePlayerMapHeaderDesigns.legend,
    );
    expect(getPlayerMapHeaderDesign({ gold: 334, silver: 0, bronze: 0 })).toBe(
      activePlayerMapHeaderDesigns.mythic,
    );
  });

  test("legend backgrounds bring their own name style", () => {
    const legend = { gold: 200, silver: 0, bronze: 0 };
    for (const design of designsForTier("legend")) {
      expect(getPlayerMapNameStyle(legend, design)).toBe(
        PLAYER_MAP_HEADER_DESIGNS[design].nameStyle!,
      );
    }
    expect(getPlayerMapNameStyle(legend, "atlas")).toBe(PLAYER_NAME_STYLES.legend);
  });

  test("mythic backgrounds bring their own name style", () => {
    const mythic = { gold: 400, silver: 0, bronze: 0 };
    for (const design of designsForTier("mythic")) {
      expect(getPlayerMapNameStyle(mythic, design)).toBe(
        PLAYER_MAP_HEADER_DESIGNS[design].nameStyle!,
      );
    }
    expect(getPlayerMapNameStyle(mythic, "atlas")).toBe(PLAYER_NAME_STYLES.mythic);
    expect(PLAYER_NAME_STYLES.mythic).toBe(
      PLAYER_MAP_HEADER_DESIGNS[activePlayerMapHeaderDesigns.mythic].nameStyle!,
    );
  });

  const cases: Array<Pick<RenderPlayerMapOptions, "mode" | "kind" | "locationCodes">> = [
    { mode: "country", kind: "wins", locationCodes: ["TR", "BR", "JP"] },
    { mode: "province", kind: "starts", locationCodes: ["06", "34", "35"] },
  ];
  test.each(cases)(
    "all designs keep the $mode $kind geography unchanged",
    async (options) => {
      const render = (headerDesign: PlayerMapHeaderDesign) =>
        renderPlayerMap({
          ...options,
          headerDesign,
          playerName: "Şanlıurfa Çağrı ".repeat(20),
          // Mythic medal points unlock every design.
          medals: { gold: 300, silver: 140, bronze: 80 },
          gameCount: 42,
          generatedAt: new Date("2026-10-07T10:20:00Z"),
        });
      const decode = async (buffer: Buffer) => {
        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          header: Bun.hash(context.getImageData(0, 0, image.width, MAP_HEADER_HEIGHT).data),
          geography: Bun.hash(
            context.getImageData(
              0,
              MAP_HEADER_HEIGHT,
              image.width,
              image.height - MAP_HEADER_HEIGHT,
            ).data,
          ),
        };
      };
      const plain = await decode(render("plain").buffer);
      const headers = new Set([plain.header]);
      for (const design of designs) {
        const map = render(design);
        const decoded = await decode(map.buffer);
        expect(Array.from(map.buffer.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(map.buffer.byteLength).toBeLessThan(8 * 1024 * 1024);
        expect(decoded.width).toBe(plain.width);
        expect(decoded.height).toBe(plain.height);
        expect(decoded.geography).toBe(plain.geography);
        expect(headers.has(decoded.header)).toBe(false);
        headers.add(decoded.header);
      }
    },
    30_000,
  );
});
