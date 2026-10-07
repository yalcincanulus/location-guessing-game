import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  activePlayerMapHeaderDesign,
  getPlayerMapHeaderDesign,
  PLAYER_MAP_HEADER_DESIGNS,
  type PlayerMapHeaderDesign,
} from "./player-map-header-designs.ts";
import { MAP_HEADER_HEIGHT } from "./map-header.ts";
import { renderPlayerMap, type RenderPlayerMapOptions } from "./player-map-renderer.ts";

const designs = Object.keys(PLAYER_MAP_HEADER_DESIGNS).filter(
  (design) => design !== "plain",
) as PlayerMapHeaderDesign[];

describe("explorer map headers", () => {
  test.each(designs)("%s is available at 400 medals and preserves the lower tiers", (design) => {
    expect(getPlayerMapHeaderDesign({ gold: 200, silver: 100, bronze: 99 }, design)).toBe("plain");
    expect(getPlayerMapHeaderDesign({ gold: 0, silver: 250, bronze: 150 }, design)).toBe(design);
    expect(getPlayerMapHeaderDesign({ gold: 0, silver: 0, bronze: 1000 }, design)).toBe(design);
  });

  test("uses the selected design when no preview override is supplied", () => {
    expect(getPlayerMapHeaderDesign({ gold: 400, silver: 0, bronze: 0 })).toBe(
      activePlayerMapHeaderDesign,
    );
  });

  const cases: Array<Pick<RenderPlayerMapOptions, "mode" | "kind" | "locationCodes">> = [
    { mode: "country", kind: "wins", locationCodes: ["TR", "BR", "JP"] },
    { mode: "province", kind: "starts", locationCodes: ["06", "34", "35"] },
  ];
  test.each(cases)("all designs keep the $mode $kind geography unchanged", async (options) => {
    const render = (headerDesign: PlayerMapHeaderDesign) =>
      renderPlayerMap({
        ...options,
        headerDesign,
        playerName: "Şanlıurfa Çağrı ".repeat(20),
        medals: { gold: 180, silver: 140, bronze: 80 },
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
          context.getImageData(0, MAP_HEADER_HEIGHT, image.width, image.height - MAP_HEADER_HEIGHT)
            .data,
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
  });
});
