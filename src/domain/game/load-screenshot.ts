/**
 * Discord CDN attachment URLs (`?ex=&is=&hm=`) expire after ~24 hours.
 * Fetching the original message returns a fresh signed URL.
 */

export type ScreenshotBytes = {
  buffer: Buffer;
  filename: string;
  url: string;
};

export type ScreenshotRefresh = {
  url: string;
  name?: string;
};

const EXPIRY_SKEW_MS = 30_000;

/** Unix-seconds expiry from Discord's hex `ex` query param, as epoch ms. */
export const discordAttachmentExpiryMs = (url: string): number | undefined => {
  try {
    const ex = new URL(url).searchParams.get("ex");
    if (!ex) {
      return undefined;
    }
    const seconds = Number.parseInt(ex, 16);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return undefined;
    }
    return seconds * 1000;
  } catch {
    return undefined;
  }
};

export const isDiscordAttachmentUrlExpired = (url: string, nowMs = Date.now()) => {
  const expiryMs = discordAttachmentExpiryMs(url);
  if (expiryMs == null) {
    return false;
  }
  return expiryMs <= nowMs + EXPIRY_SKEW_MS;
};

export const filenameFromAttachmentUrl = (url: string, fallback: string) => {
  try {
    const last = new URL(url).pathname.split("/").pop();
    if (!last) {
      return fallback;
    }
    return decodeURIComponent(last) || fallback;
  } catch {
    return fallback;
  }
};

const download = async (
  url: string,
  fetchImpl: typeof fetch,
  name: string | undefined,
  fallbackName: string,
): Promise<ScreenshotBytes | undefined> => {
  const response = await fetchImpl(url);
  if (!response.ok) {
    return undefined;
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: name || filenameFromAttachmentUrl(url, fallbackName),
    url,
  };
};

export const loadGameScreenshot = async ({
  screenshotUrl,
  fallbackName,
  refreshUrl,
  fetchImpl = fetch,
}: {
  screenshotUrl: string;
  fallbackName: string;
  refreshUrl?: () => Promise<ScreenshotRefresh | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<ScreenshotBytes | undefined> => {
  if (!isDiscordAttachmentUrlExpired(screenshotUrl)) {
    const current = await download(screenshotUrl, fetchImpl, undefined, fallbackName);
    if (current) {
      return current;
    }
  }

  const refreshed = await refreshUrl?.();
  if (!refreshed?.url) {
    return undefined;
  }

  return download(refreshed.url, fetchImpl, refreshed.name, fallbackName);
};
