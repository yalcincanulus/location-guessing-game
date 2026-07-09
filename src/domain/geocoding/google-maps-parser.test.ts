import { describe, expect, test } from "bun:test";
import { detectPanoramaCoverageSource, parseGoogleMapsUrl } from "./google-maps-parser.ts";

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
