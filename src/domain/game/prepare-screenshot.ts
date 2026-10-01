import { createCanvas, loadImage } from "@napi-rs/canvas";
import { fitScreenshotForDiscord, MAX_SCREENSHOT_BYTES } from "../../util/fit-screenshot.ts";
import {
  addFairPlayMetadata,
  FAIR_PLAY_METADATA_BYTES,
  hasFairPlayMetadata,
} from "../../util/screenshot-metadata.ts";
import { logger } from "../../util/logger.ts";

const appendFooter = async (buffer: Buffer, footer: string) => {
  // Read dimensions with a pixel limit before the canvas decoder allocates memory.
  await new Bun.Image(buffer, { maxPixels: 8192 * 8192 }).metadata();
  const image = await loadImage(buffer);
  const fontSize = Math.max(6, Math.round(image.width / 100));
  const padding = Math.max(1, Math.round(fontSize / 6));
  const lineHeight = Math.ceil(fontSize * 1.15);
  const footerHeight = padding * 2 + lineHeight;
  const canvas = createCanvas(image.width, image.height + footerHeight);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  context.fillStyle = "#20242b";
  context.fillRect(0, image.height, image.width, footerHeight);
  context.font = `${fontSize}px "DejaVu Sans", Arial, sans-serif`;
  context.fillStyle = "#d9dde5";
  context.textBaseline = "middle";
  context.fillText(
    footer.replace(/\s+/g, " ").trim(),
    padding,
    image.height + padding + lineHeight / 2,
    Math.max(1, image.width - padding * 2),
  );
  return canvas.encode("png");
};

/** Adds the AI notice at publication or repost, without duplicating an existing footer. */
export const prepareGameScreenshot = async (
  buffer: Buffer,
  name: string,
  footer?: string,
  maxBytes = MAX_SCREENSHOT_BYTES,
): Promise<{ buffer: Buffer; name: string } | undefined> => {
  if (!footer?.length) {
    return fitScreenshotForDiscord(buffer, name, maxBytes);
  }

  try {
    const alreadyPrepared = hasFairPlayMetadata(buffer);
    const image = alreadyPrepared ? buffer : await appendFooter(buffer, footer);
    const fitted = await fitScreenshotForDiscord(
      image,
      alreadyPrepared ? name : "screenshot.png",
      maxBytes - FAIR_PLAY_METADATA_BYTES,
    );
    if (!fitted) {
      return undefined;
    }
    return { buffer: addFairPlayMetadata(fitted.buffer), name: fitted.name };
  } catch (error) {
    logger.warn("Could not add screenshot fair play notice; using the original image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fitScreenshotForDiscord(buffer, name, maxBytes);
  }
};
