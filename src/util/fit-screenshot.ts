import { logger } from "./logger.ts";

/** Discord's default bot upload limit (10 MiB). */
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
export const MAX_SCREENSHOT_MB = MAX_SCREENSHOT_BYTES / (1024 * 1024);

const COMPRESS_ATTEMPTS = [
  { maxEdge: 2560, quality: 85 },
  { maxEdge: 1920, quality: 80 },
  { maxEdge: 1600, quality: 72 },
  { maxEdge: 1280, quality: 65 },
  { maxEdge: 1024, quality: 55 },
] as const;

const toJpegFilename = (name: string) => {
  const base = name.replace(/\.[^.]+$/, "").trim() || "screenshot";
  return `${base}.jpg`;
};

/**
 * Ensures a screenshot fits Discord's bot upload limit via Bun.Image
 * resize + JPEG re-encode. Returns the original buffer when already small enough.
 * @see https://bun.com/docs/runtime/image.md
 */
export const fitScreenshotForDiscord = async (
  buffer: Buffer,
  name: string,
  maxBytes = MAX_SCREENSHOT_BYTES,
): Promise<{ buffer: Buffer; name: string } | undefined> => {
  if (buffer.byteLength <= maxBytes) {
    return { buffer, name };
  }

  const originalBytes = buffer.byteLength;

  for (const { maxEdge, quality } of COMPRESS_ATTEMPTS) {
    try {
      const out = await new Bun.Image(buffer, { maxPixels: 8192 * 8192 })
        .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality })
        .buffer();

      if (out.byteLength <= maxBytes) {
        logger.info("Reduced oversized screenshot for Discord upload", {
          originalMb: Number((originalBytes / (1024 * 1024)).toFixed(2)),
          compressedMb: Number((out.byteLength / (1024 * 1024)).toFixed(2)),
          maxEdge,
          quality,
          filename: toJpegFilename(name),
        });
        return { buffer: out, name: toJpegFilename(name) };
      }
    } catch (error) {
      logger.warn("Screenshot compress attempt failed", {
        maxEdge,
        quality,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.warn("Could not compress screenshot under Discord upload limit", {
    originalBytes,
    maxBytes,
  });
  return undefined;
};
