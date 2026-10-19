import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, test } from "bun:test";
import { drawTurkishFlag, turkishFlagGeometry } from "./turkish-flag.ts";

describe("drawTurkishFlag", () => {
  test("matches the Flag Law construction (G = 60000 in the official sheet)", () => {
    const toSheet = ({ x, radius }: { x: number; radius: number }) => ({
      x: x * 60000,
      radius: radius * 60000,
    });
    const geometry = turkishFlagGeometry();
    expect(toSheet(geometry.outer)).toEqual({ x: 30000, radius: 15000 });
    expect(toSheet(geometry.inner)).toEqual({ x: 33750, radius: 12000 });
    // The star's hoist-side tip sits 1/3 G past the inner circle's hoist-side edge.
    expect(toSheet(geometry.star).x - toSheet(geometry.star).radius).toBeCloseTo(41750, 6);
    expect(toSheet(geometry.star).radius).toBe(7500);
  });

  test("draws a red 3:2 field with a white crescent and star", () => {
    const g = 200;
    const canvas = createCanvas(g * 1.5, g);
    const context = canvas.getContext("2d");
    drawTurkishFlag(context, 0, 0, g);
    const pixel = (x: number, y: number) => {
      const [r, gr, b] = context.getImageData(Math.round(x * g), Math.round(y * g), 1, 1).data;
      return r! > 240 && gr! > 240 && b! > 240 ? "white" : r! > 200 && gr! < 40 ? "red" : "other";
    };
    expect(pixel(0.02, 0.02)).toBe("red");
    expect(pixel(1.48, 0.98)).toBe("red");
    // Crescent band between the outer (left edge 0.25 G) and inner (left edge 0.3625 G) circles.
    expect(pixel(0.3, 0.5)).toBe("white");
    expect(pixel(0.56, 0.5)).toBe("red");
    expect(pixel(0.8208, 0.5)).toBe("white");
    expect(pixel(1.1, 0.5)).toBe("red");
  });
});
