import { describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { enMessages } from "../../i18n/en.ts";
import { trMessages } from "../../i18n/tr.ts";
import { FAIR_PLAY_METADATA_NOTICE, hasFairPlayMetadata } from "../../util/screenshot-metadata.ts";
import { prepareGameScreenshot } from "./prepare-screenshot.ts";

const makeScreenshot = (width = 640, height = 320) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#1a4d7c";
  context.fillRect(0, 0, width, height);
  for (let i = 0; i < width * height * 0.02; i++) {
    context.fillStyle = `rgb(${i % 255},${(i * 3) % 255},${(i * 7) % 255})`;
    context.fillRect(i % width, (i * 13) % height, 3, 3);
  }
  return canvas;
};

describe("prepareGameScreenshot", () => {
  test("preserves the original image when notices are disabled", async () => {
    const buffer = makeScreenshot().toBuffer("image/png");
    const result = await prepareGameScreenshot(buffer, "istanbul.png");
    expect(result?.buffer).toBe(buffer);
    expect(result?.name).toBe("screenshot.png");
    expect(hasFairPlayMetadata(result!.buffer)).toBe(false);
  });

  for (const messages of [enMessages, trMessages]) {
    test(`adds a single-line ${messages.locale} footer without covering or resizing the scene`, async () => {
      const original = makeScreenshot();
      const result = await prepareGameScreenshot(
        original.toBuffer("image/png"),
        "location.png",
        messages.fairPlay.footer,
      );
      expect(result).toBeDefined();
      expect(result!.name).toBe("screenshot.png");
      expect(hasFairPlayMetadata(result!.buffer)).toBe(true);
      expect(result!.buffer.includes(Buffer.from(FAIR_PLAY_METADATA_NOTICE))).toBe(true);

      const image = await loadImage(result!.buffer);
      expect(image.width).toBe(original.width);
      expect(image.height).toBeGreaterThan(original.height);
      expect(image.height - original.height).toBeLessThanOrEqual(12);
      const rendered = createCanvas(image.width, image.height);
      rendered.getContext("2d").drawImage(image, 0, 0);
      expect(
        rendered.getContext("2d").getImageData(0, 0, original.width, original.height).data,
      ).toEqual(original.getContext("2d").getImageData(0, 0, original.width, original.height).data);
    });
  }

  test("keeps the notice metadata when an oversized annotated image becomes JPEG", async () => {
    const source = makeScreenshot(2400, 1800).toBuffer("image/png");
    const maxBytes = Math.floor(source.byteLength * 0.7);
    const result = await prepareGameScreenshot(
      source,
      "location.png",
      enMessages.fairPlay.footer,
      maxBytes,
    );
    expect(result).toBeDefined();
    expect(result!.name).toBe("screenshot.jpg");
    expect(result!.buffer.byteLength).toBeLessThanOrEqual(maxBytes);
    expect(hasFairPlayMetadata(result!.buffer)).toBe(true);
    const image = await loadImage(result!.buffer);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  });

  test("does not add a second footer when a prepared image is reused", async () => {
    const first = await prepareGameScreenshot(
      makeScreenshot().toBuffer("image/png"),
      "location.png",
      enMessages.fairPlay.footer,
    );
    const second = await prepareGameScreenshot(
      first!.buffer,
      first!.name,
      enMessages.fairPlay.footer,
    );
    expect(second?.buffer).toBe(first!.buffer);
    expect(second?.name).toBe(first!.name);
  });
});
