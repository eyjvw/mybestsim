import { describe, expect, test } from "bun:test";
import { estimateData, findPlans, isEligible, USAGE_PROFILES } from "./finder";
import { product } from "./fixtures";

const fr = (o: Parameters<typeof product>[0]) =>
  product({ countryCode: "FR", countryName: "France", ...o });
const catalog = [
  fr({ sku: "fr-small", dataGb: 3, validityDays: 30, price: 8 }),
  fr({ sku: "fr-ok", dataGb: 10, validityDays: 15, price: 15 }),
  fr({ sku: "fr-unl", dataGb: null, validityDays: 30, price: 40 }),
  fr({ sku: "fr-short", dataGb: 20, validityDays: 7, price: 9 }),
  product({
    sku: "eu",
    countryCode: "EU",
    countryName: "Europe",
    dataGb: 20,
    validityDays: 30,
    price: 12,
  }),
  product({
    sku: "ww",
    countryCode: "WW",
    countryName: "Monde",
    dataGb: 10,
    validityDays: 30,
    price: 30,
  }),
  product({
    sku: "jp",
    countryCode: "JP",
    countryName: "Japon",
    dataGb: 50,
    validityDays: 30,
    price: 5,
  }),
];

describe("findPlans", () => {
  test("keeps offers covering the whole trip with enough data, cheapest first", () => {
    const r = findPlans(catalog, { destination: "FR", data: 10, days: 10, regional: false });
    expect(r.matches.map((m) => m.product.sku)).toEqual(["fr-ok", "fr-unl"]);
    expect(r.eligible).toBe(2);
    expect(r.medianPrice).toBe(27.5);
    expect(r.matches[0].saving).toBe(12.5);
    expect(r.cheapestLocal?.sku).toBe("fr-ok");
  });

  test("regional plans can beat the local offer and are labelled", () => {
    const r = findPlans(catalog, { destination: "FR", data: 10, days: 10, regional: true });
    expect(r.matches.map((m) => [m.product.sku, m.viaRegion])).toEqual([
      ["eu", "EU"],
      ["fr-ok", null],
      ["ww", "WW"],
      ["fr-unl", null],
    ]);
    expect(r.cheapestLocal?.sku).toBe("fr-ok");
  });

  test("unlimited need only accepts unlimited offers", () => {
    const r = findPlans(catalog, {
      destination: "FR",
      data: "unlimited",
      days: 30,
      regional: true,
    });
    expect(r.matches.map((m) => m.product.sku)).toEqual(["fr-unl"]);
  });

  test("no offer longer than the catalog's validity", () => {
    const r = findPlans(catalog, { destination: "FR", data: 1, days: 45, regional: true });
    expect(r).toMatchObject({ eligible: 0, medianPrice: null, cheapestLocal: null, matches: [] });
  });

  test("isEligible rejects other destinations", () => {
    expect(
      isEligible(catalog[6], { destination: "FR", data: 1, days: 1, regional: true }, ["EU", "WW"]),
    ).toBe(false);
  });
});

describe("estimateData", () => {
  test("rounds up to the smallest tier, unlimited beyond 50 Go", () => {
    expect(estimateData(7, 0.3)).toBe(3);
    expect(estimateData(10, 1)).toBe(10);
    expect(estimateData(11, 1)).toBe(20);
    expect(estimateData(30, 2.5)).toBe("unlimited");
  });

  test("profiles grow with usage", () => {
    const rates = USAGE_PROFILES.map((p) => p.gbPerDay);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });
});
