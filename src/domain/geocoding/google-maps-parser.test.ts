import { describe, expect, test } from "bun:test";
import { detectPanoramaCoverageSource, parseGoogleMapsUrl } from "./google-maps-parser.ts";

const requestUrl = (input: string | URL | Request) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

describe("detectPanoramaCoverageSource", () => {
  test("detects official Google Street View from !2e0", () => {
    const url =
      "https://www.google.com/maps/@48.8583445,2.2943296,3a,75y,313.07h,81.5t/data=!3m6!1e1!3m4!1sABC123!2e0!7i16384!8i8192";
    expect(detectPanoramaCoverageSource(url)).toBe("google");
  });

  test("detects third-party photospheres from !2e10", () => {
    const url =
      "https://www.google.com/maps/@13.4550671,-16.5770576,3a,90y,134.92h,76.14t/data=!3m6!1e1!3m5!1sCIHM0ogKEICAgICTpIrevgE!2e10!7i10560!8i5280";
    expect(detectPanoramaCoverageSource(url)).toBe("third-party");
  });

  test("returns unknown when the link has no panorama type marker", () => {
    expect(detectPanoramaCoverageSource("https://www.google.com/maps/@48.85,2.29,17z")).toBe(
      "unknown",
    );
  });

  test("prefers third-party when both markers somehow appear", () => {
    expect(detectPanoramaCoverageSource("...!2e0!...!2e10!")).toBe("third-party");
  });
});

describe("parseGoogleMapsUrl coverageSource", () => {
  test("attaches coverage source to parsed coordinates", async () => {
    const parsed = await parseGoogleMapsUrl(
      "https://www.google.com/maps/@48.8583445,2.2943296,3a,75y,0h,90t/data=!3m6!1e1!3m4!1sABC!2e0!7i16384!8i8192",
    );
    expect(parsed?.latitude).toBeCloseTo(48.8583445);
    expect(parsed?.coverageSource).toBe("google");
  });
});

const jejuPanoOnlyUrl =
  "https://www.google.com/maps/@/data=!3m7!1e1!3m5!1s4OHwL_RhsHFGeQQKWiUYCg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-5.200000000000003%26panoid%3D4OHwL_RhsHFGeQQKWiUYCg%26yaw%3D216.86!7i13312!8i6656";

const jejuPanoMetadataBody =
  '/**/_xdc_._m && _xdc_._m([[0],[[[1],[2,"4OHwL_RhsHFGeQQKWiUYCg"],[],[],[],[[[1],[[null,null,33.50579270822461,126.6790639513802]]]]]]])';

const metadataFetch = (async (input, init) => {
  const url = requestUrl(input as string | URL | Request);
  if (init?.method === "HEAD") {
    return new Response(null, { status: 200 });
  }
  if (url.includes("GeoPhotoService.GetMetadata")) {
    return new Response(jejuPanoMetadataBody, {
      status: 200,
      headers: { "content-type": "text/javascript" },
    });
  }
  return new Response("unexpected fetch", { status: 500 });
}) as typeof fetch;

describe("parseGoogleMapsUrl panorama-only links", () => {
  test("resolves Street View share links that have a pano id but no @lat,lng", async () => {
    const parsed = await parseGoogleMapsUrl(jejuPanoOnlyUrl, { fetchImpl: metadataFetch });
    expect(parsed?.latitude).toBeCloseTo(33.50579270822461);
    expect(parsed?.longitude).toBeCloseTo(126.6790639513802);
    expect(parsed?.coverageSource).toBe("google");
  });

  test("follows maps.app.goo.gl short links to a pano-only Street View URL", async () => {
    const shortUrl = "https://maps.app.goo.gl/VXNpA7LAuZ5CNvwo7";
    const fetchImpl = (async (input, init) => {
      const url = requestUrl(input as string | URL | Request);
      if (init?.method === "HEAD" && url === shortUrl) {
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, "url", { value: jejuPanoOnlyUrl });
        return response;
      }
      if (url.includes("GeoPhotoService.GetMetadata")) {
        return new Response(jejuPanoMetadataBody, { status: 200 });
      }
      return new Response("unexpected fetch", { status: 500 });
    }) as typeof fetch;

    const parsed = await parseGoogleMapsUrl(shortUrl, { fetchImpl });
    expect(parsed?.latitude).toBeCloseTo(33.50579270822461);
    expect(parsed?.longitude).toBeCloseTo(126.6790639513802);
    expect(parsed?.originalUrl).toBe(shortUrl);
  });

  test("resolves third-party photosphere ids from !2e10 links", async () => {
    const url =
      "https://www.google.com/maps/@/data=!3m6!1e1!3m5!1sCIHM0ogKEICAgICTpIrevgE!2e10!7i10560!8i5280";
    const fetchImpl = (async (input) => {
      const requested = requestUrl(input as string | URL | Request);
      if (!requested.includes("GeoPhotoService.GetMetadata")) {
        return new Response("unexpected fetch", { status: 500 });
      }
      if (!requested.includes("!1e10!2sCIHM0ogKEICAgICTpIrevgE")) {
        return new Response("/**/_xdc_._m && _xdc_._m([[3]])", { status: 200 });
      }
      const data = [
        [0],
        [
          [
            [1],
            [10, "CIHM0ogKEICAgICTpIrevgE"],
            [],
            [],
            [],
            [[[1], [[null, null, 13.45506713683604, -16.57705755810356]]]],
          ],
        ],
      ];
      return new Response(`/**/_xdc_._m && _xdc_._m(${JSON.stringify(data)})`, { status: 200 });
    }) as typeof fetch;

    const parsed = await parseGoogleMapsUrl(url, { fetchImpl });
    expect(parsed?.latitude).toBeCloseTo(13.45506713683604);
    expect(parsed?.longitude).toBeCloseTo(-16.57705755810356);
    expect(parsed?.coverageSource).toBe("third-party");
  });

  test("ignores the 0,0 thumbnail placeholder in South Korea plus-code links", async () => {
    const url =
      "https://www.google.com/maps/@8Q78FC6X+RJW3752,6a,60y,31.16h,99.75t/data=!3m5!1e1!3m3!1s_H35o32zKUJhOsSafHWfqQ!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fpanoid%3D_H35o32zKUJhOsSafHWfqQ%26w%3D900%26h%3D600%26ll%3D0.0,0.0%26yaw%3D31.0%26pitch%3D-9.0%26thumbfov%3D81%26cb_client%3Dgmm.iv.android?utm_source=mstt_0";
    const fetchImpl = (async (input) => {
      const requested = requestUrl(input as string | URL | Request);
      if (!requested.includes("!2s_H35o32zKUJhOsSafHWfqQ")) {
        return new Response("unexpected fetch", { status: 500 });
      }
      const data = [
        [0],
        [
          [
            [1],
            [2, "_H35o32zKUJhOsSafHWfqQ"],
            [],
            [],
            [],
            [[[1], [[null, null, 35.4621, 126.449]]]],
          ],
        ],
      ];
      return new Response(`/**/_xdc_._m && _xdc_._m(${JSON.stringify(data)})`, { status: 200 });
    }) as typeof fetch;

    const parsed = await parseGoogleMapsUrl(url, { fetchImpl });
    expect(parsed?.latitude).toBeCloseTo(35.4621);
    expect(parsed?.longitude).toBeCloseTo(126.449);
    expect(parsed?.source).toBe("google-pano-metadata");
  });
});
