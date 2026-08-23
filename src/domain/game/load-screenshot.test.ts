import { describe, expect, test } from "bun:test";
import {
  discordAttachmentExpiryMs,
  filenameFromAttachmentUrl,
  isDiscordAttachmentUrlExpired,
  loadGameScreenshot,
} from "./load-screenshot.ts";

const signedUrl = (expiresAtMs: number, name = "shot.png") => {
  const ex = Math.floor(expiresAtMs / 1000).toString(16);
  return `https://cdn.discordapp.com/attachments/111/222/${name}?ex=${ex}&is=1&hm=abc`;
};

const requestUrl = (input: string | URL | Request) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const jsonFetch = (routes: Record<string, { status: number; body: Uint8Array }>): typeof fetch =>
  (async (input) => {
    const url = requestUrl(input as string | URL | Request);
    const route = routes[url];
    if (!route) {
      return new Response(null, { status: 404 });
    }
    return new Response(route.body, { status: route.status });
  }) as typeof fetch;

describe("discord attachment URL expiry", () => {
  test("reads the hex ex query param as a unix timestamp", () => {
    const expiresAt = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(discordAttachmentExpiryMs(signedUrl(expiresAt))).toBe(expiresAt);
  });

  test("treats a past ex timestamp as expired", () => {
    const url = signedUrl(Date.now() - 60_000);
    expect(isDiscordAttachmentUrlExpired(url)).toBe(true);
  });

  test("treats a future ex timestamp as fresh", () => {
    const url = signedUrl(Date.now() + 3_600_000);
    expect(isDiscordAttachmentUrlExpired(url)).toBe(false);
  });

  test("does not assume expiry when the URL has no ex param", () => {
    expect(
      isDiscordAttachmentUrlExpired("https://cdn.discordapp.com/attachments/1/2/shot.png"),
    ).toBe(false);
  });
});

describe("filenameFromAttachmentUrl", () => {
  test("uses the path segment and decodes it", () => {
    expect(
      filenameFromAttachmentUrl(
        "https://cdn.discordapp.com/attachments/1/2/my%20shot.png?ex=1",
        "fallback.png",
      ),
    ).toBe("my shot.png");
  });
});

describe("loadGameScreenshot", () => {
  test("downloads a still-valid stored URL without refreshing", async () => {
    const url = signedUrl(Date.now() + 3_600_000);
    const body = Uint8Array.from([9, 8, 7]);
    const result = await loadGameScreenshot({
      screenshotUrl: url,
      fallbackName: "fallback.png",
      refreshUrl: async () => {
        throw new Error("should not refresh a fresh URL");
      },
      fetchImpl: jsonFetch({ [url]: { status: 200, body } }),
    });

    expect(result?.url).toBe(url);
    expect(result?.filename).toBe("shot.png");
    expect([...result!.buffer]).toEqual([9, 8, 7]);
  });

  test("refreshes from the original Discord message when the stored URL is expired", async () => {
    const expired = signedUrl(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const fresh = signedUrl(Date.now() + 3_600_000, "street-view.jpg");
    const body = Uint8Array.from([1, 2, 3, 4]);
    const tried: string[] = [];

    const result = await loadGameScreenshot({
      screenshotUrl: expired,
      fallbackName: "fallback.png",
      refreshUrl: async () => ({ url: fresh, name: "street-view.jpg" }),
      fetchImpl: (async (input) => {
        const url = requestUrl(input as string | URL | Request);
        tried.push(url);
        if (url === fresh) {
          return new Response(body, { status: 200 });
        }
        return new Response("This content is no longer available.", { status: 404 });
      }) as typeof fetch,
    });

    expect(tried).toEqual([fresh]);
    expect(result?.url).toBe(fresh);
    expect(result?.filename).toBe("street-view.jpg");
    expect([...result!.buffer]).toEqual([1, 2, 3, 4]);
  });

  test("falls back to refresh when a non-expired URL still 404s", async () => {
    const stored = signedUrl(Date.now() + 3_600_000);
    const fresh = signedUrl(Date.now() + 7_200_000, "retry.png");
    const result = await loadGameScreenshot({
      screenshotUrl: stored,
      fallbackName: "fallback.png",
      refreshUrl: async () => ({ url: fresh, name: "retry.png" }),
      fetchImpl: jsonFetch({
        [stored]: { status: 404, body: new Uint8Array() },
        [fresh]: { status: 200, body: Uint8Array.from([5]) },
      }),
    });

    expect(result?.filename).toBe("retry.png");
    expect([...result!.buffer]).toEqual([5]);
  });

  test("returns undefined when the URL is expired and there is no message to refresh", async () => {
    const expired = signedUrl(Date.now() - 60_000);
    const result = await loadGameScreenshot({
      screenshotUrl: expired,
      fallbackName: "fallback.png",
      fetchImpl: jsonFetch({}),
    });
    expect(result).toBeUndefined();
  });
});
