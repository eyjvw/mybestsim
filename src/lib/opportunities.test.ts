import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import { loadCatalog } from "./load";
import { computeOpportunities, MIN_COMPARABLE_PLANS } from "./opportunities";
import type { Product } from "./types";

/** `n` plans of one destination, each sold by two providers at `low` and `high`. */
function plans(code: string, name: string, n: number, low: number, high: number): Product[] {
  return Array.from({ length: n }, (_, i) => [
    product({
      countryCode: code,
      countryName: name,
      dataGb: i + 1,
      provider: "Airalo",
      price: low,
    }),
    product({
      countryCode: code,
      countryName: name,
      dataGb: i + 1,
      provider: "Ubigi",
      price: high,
    }),
  ]).flat();
}

describe("computeOpportunities", () => {
  test("ranks destinations by the median price gap of a plan sold by two providers or more", () => {
    const o = computeOpportunities([
      ...plans("IT", "Italie", 5, 10, 12),
      ...plans("JP", "Japon", 5, 10, 15),
      ...plans("ES", "Espagne", MIN_COMPARABLE_PLANS - 1, 10, 30), // too few plans to rank
    ]);
    expect(o.gaps.map((g) => [g.countryCode, g.medianGap, g.comparable, g.providers])).toEqual([
      ["JP", 5, 5, 2],
      ["IT", 2, 5, 2],
    ]);
    expect(o.gaps[0].medianGapPct).toBeCloseTo(5 / 15);
    expect(o.gaps[0].url).toBe("https://mybestsim.com/fr/comparaison-meilleure-carte-esim-japon/");
  });

  test("a plan sold by one provider only is not comparable", () => {
    const solo = plans("IT", "Italie", 6, 10, 12).filter((p) => p.provider === "Airalo");
    expect(computeOpportunities(solo).gaps).toEqual([]);
  });

  test("follows the selection: an unknown destination is ranked but not linked", () => {
    const o = computeOpportunities(plans("ZZ", "Nouveau pays", 5, 10, 11));
    expect(o.gaps.map((g) => [g.countryCode, g.url])).toEqual([["ZZ", null]]);
  });

  test("on the reference catalog, regional plans vary most and every destination is linked", () => {
    const o = computeOpportunities(loadCatalog().products);
    expect(o.gaps).toHaveLength(8);
    expect(o.gaps.slice(0, 4).map((g) => g.countryCode)).toEqual(["WW", "EU", "AS", "NA"]);
    expect(o.gaps[0].medianGap).toBeCloseTo(5.1, 2);
    const uk = o.gaps.find((g) => g.countryCode === "GB");
    expect(uk?.url).toBe("https://mybestsim.com/fr/meilleure-carte-esim-royaume-uni/");
    expect(o.gaps.every((g) => g.url !== null)).toBe(true);
  });
});
