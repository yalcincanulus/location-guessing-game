import { describe, expect, test } from "bun:test";
import { describeProvinceLocation, METROPOLITAN_PROVINCE_CODES } from "./municipality.ts";

// Addresses below are real Nominatim responses (Accept-Language: tr), trimmed.
const at = (address: Record<string, string | undefined>) => ({ address });

describe("describeProvinceLocation", () => {
  test("uses the district from `town` outside the central district", () => {
    expect(
      describeProvinceLocation(
        at({ town: "Sorgun", county: "Yozgat Merkez", province: "Yozgat" }),
        "66",
      ),
    ).toEqual({
      district: "Sorgun",
      municipality: "Sorgun Belediyesi",
      metropolitanMunicipality: undefined,
      neighbourhood: undefined,
    });
  });

  test("adds the metropolitan municipality and the mahalle in büyükşehir provinces", () => {
    expect(
      describeProvinceLocation(
        at({
          suburb: "Osmanağa Mahallesi",
          town: "Kadıköy",
          province: "İstanbul",
        }),
        "34",
      ),
    ).toEqual({
      district: "Kadıköy",
      municipality: "Kadıköy Belediyesi",
      metropolitanMunicipality: "İstanbul Büyükşehir Belediyesi",
      neighbourhood: "Osmanağa Mahallesi",
    });
  });

  test("maps the central district to the province municipality", () => {
    for (const address of [
      { suburb: "İhsaniye Mahallesi", city: "Bolu Merkez", province: "Bolu" },
      { suburb: "Medrese Mahallesi", city: "Yozgat", county: "Yozgat Merkez", province: "Yozgat" },
    ]) {
      const code = address.province === "Bolu" ? "14" : "66";
      const details = describeProvinceLocation(at(address), code);
      expect(details.district).toBe("Merkez");
      expect(details.municipality).toBe(`${address.province} Belediyesi`);
      expect(details.metropolitanMunicipality).toBeUndefined();
    }
  });

  test("handles names that already end in Belediyesi", () => {
    const details = describeProvinceLocation(
      at({ suburb: "Pirimehmet Mahallesi", city: "Isparta Belediyesi", province: "Isparta" }),
      "32",
    );
    expect(details.district).toBe("Merkez");
    expect(details.municipality).toBe("Isparta Belediyesi");
  });

  test("uses the village for rural points", () => {
    const details = describeProvinceLocation(
      at({ village: "Gökçeören Mahallesi", town: "Kalecik", province: "Ankara" }),
      "06",
    );
    expect(details.municipality).toBe("Kalecik Belediyesi");
    expect(details.neighbourhood).toBe("Gökçeören Mahallesi");
  });

  test("returns only what it knows", () => {
    expect(describeProvinceLocation(undefined, "06")).toEqual({
      district: undefined,
      municipality: undefined,
      metropolitanMunicipality: "Ankara Büyükşehir Belediyesi",
      neighbourhood: undefined,
    });
  });

  test("lists 30 metropolitan provinces", () => {
    expect(METROPOLITAN_PROVINCE_CODES.size).toBe(30);
  });
});
