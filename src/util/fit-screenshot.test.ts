import { describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { fitScreenshotForDiscord } from "./fit-screenshot.ts";

const makePng = (width: number, height: number) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a4d7c";
  ctx.fillRect(0, 0, width, height);
  // High-frequency noise so PNG stays large before JPEG re-encode.
  for (let i = 0; i < width * height * 0.02; i++) {
    ctx.fillStyle = `rgb(${i % 255},${(i * 3) % 255},${(i * 7) % 255})`;
    ctx.fillRect(i % width, (i * 13) % height, 3, 3);
  }
  return Buffer.from(canvas.toBuffer("image/png"));
};

describe("fitScreenshotForDiscord", () => {
  test("returns the original buffer with a neutral filename when already under the limit", async () => {
    const small = makePng(64, 64);
    const result = await fitScreenshotForDiscord(small, "istanbul-turkey.png");
    expect(result).toEqual({ buffer: small, name: "screenshot.png" });
  });

  test("compresses an oversized image under the Discord limit", async () => {
    const png = makePng(2400, 1800);
    // Use a ceiling well below the source size but achievable via JPEG re-encode.
    const maxBytes = Math.min(250_000, Math.floor(png.byteLength * 0.5));
    expect(png.byteLength).toBeGreaterThan(maxBytes);

    const result = await fitScreenshotForDiscord(png, "street-view.png", maxBytes);
    expect(result).toBeDefined();
    expect(result!.buffer.byteLength).toBeLessThanOrEqual(maxBytes);
    expect(result!.buffer.byteLength).toBeLessThan(png.byteLength);
    expect(result!.name).toBe("screenshot.jpg");
  });
});
