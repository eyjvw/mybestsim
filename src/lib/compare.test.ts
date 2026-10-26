import { describe, expect, test } from "bun:test";
import {
  computeMarket,
  dominatedOffers,
  dominates,
  dominatesWithBetterSpec,
  groupPlans,
  planKey,
} from "./compare";
import { product } from "./fixtures";
import { loadCatalog } from "./load";

describe("planKey / groupPlans", () => {
  test("groups by destination, data and validity, unlimited apart", () => {
    expect(planKey(product({ countryCode: "JP", dataGb: null, validityDays: 30 }))).toBe("JP|U|30");
    const groups = groupPlans([
      product({ provider: "A", price: 12 }),
      product({ provider: "B", price: 10 }),
      product({ provider: "B", price: 10 }),
      product({ provider: "A", dataGb: 10, price: 15 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ offers: 3, providers: 2, min: 10, max: 12, median: 10 });
    expect(groups[0].winners).toEqual(["B"]);
  });
});

describe("dominates", () => {
  const base = product({ price: 10, dataGb: 5, validityDays: 7, network: "4G", topUp: false });

  test("cheaper and at least as good on every criterion", () => {
    expect(dominates(product({ price: 9, dataGb: 5, validityDays: 7, network: "4G" }), base)).toBe(
      true,
    );
    expect(
      dominates(product({ price: 9, dataGb: null, validityDays: 30, network: "5G" }), base),
    ).toBe(true);
  });

  test.each([
    ["not cheaper", { price: 10 }],
    ["less data", { price: 9, dataGb: 3 }],
    ["shorter", { price: 9, validityDays: 5 }],
  ])("not when %s", (_, patch) => {
    expect(dominates(product({ dataGb: 5, validityDays: 7, network: "4G", ...patch }), base)).toBe(
      false,
    );
  });

  test("4G never dominates 5G, no top-up never dominates top-up", () => {
    const premium = product({ price: 10, network: "5G", topUp: true });
    expect(dominates(product({ price: 1, network: "4G", topUp: true }), premium)).toBe(false);
    expect(dominates(product({ price: 1, network: "5G", topUp: false }), premium)).toBe(false);
  });

  test("better spec excludes exact cheaper copies", () => {
    const copy = product({ price: 9, dataGb: 5, validityDays: 7, network: "4G", topUp: false });
    expect(dominates(copy, base)).toBe(true);
    expect(dominatesWithBetterSpec(copy, base)).toBe(false);
    expect(dominatesWithBetterSpec({ ...copy, topUp: true }, base)).toBe(true);
  });

  test("dominatedOffers names the cheapest dominating offer", () => {
    const pricey = product({ sku: "x", price: 20, dataGb: 5 });
    const mid = product({ sku: "m", price: 15, dataGb: 10 });
    const cheap = product({ sku: "c", price: 12, dataGb: 20 });
    const out = dominatedOffers([pricey, mid, cheap]);
    expect(out.map((d) => [d.offer.sku, d.by.sku])).toEqual([
      ["m", "c"],
      ["x", "c"],
    ]);
  });
});

describe("computeMarket", () => {
  test("savings, wins with ties, 5G premium and efficient share", () => {
    const m = computeMarket([
      product({ provider: "A", price: 10, network: "4G" }),
      product({ provider: "B", price: 10, network: "5G" }),
      product({ provider: "C", price: 16, network: "4G" }),
      product({ provider: "A", countryCode: "JP", price: 30 }),
    ]);
    expect(m.plans).toBe(2);
    expect(m.comparable).toBe(1);
    expect(m.medianSaving).toBe(0);
    expect(m.biggestGaps[0]).toMatchObject({ min: 10, max: 16 });
    expect(m.wins.map((w) => [w.provider, w.wins])).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
    // 5G median 10 vs 4G median 13.
    expect(m.networkPremium.plans).toBe(1);
    expect(m.networkPremium.medianRatio).toBeCloseTo(10 / 13, 6);
    // C (16 €, 4G) is beaten by A and B; everything else is efficient.
    expect(m.efficient).toEqual({ count: 3, share: 0.75 });
  });

  test("empty selection yields nulls, not NaN", () => {
    const m = computeMarket([]);
    expect(m).toMatchObject({ plans: 0, comparable: 0, medianSaving: null, wins: [] });
    expect(m.efficient.share).toBe(0);
  });

  // Figures measured independently with Python from the raw CSV files.
  test("real catalog", () => {
    const m = computeMarket(loadCatalog().products);
    expect(m.plans).toBe(1113);
    expect(m.efficient.count).toBe(1836);
    expect(m.biggestGaps[0]).toMatchObject({ countryCode: "EU", dataGb: null, validityDays: 30 });
    expect(m.biggestGaps[0].max - m.biggestGaps[0].min).toBeCloseTo(60.37, 2);
    expect(m.networkPremium.plans).toBe(795);
  });
});
