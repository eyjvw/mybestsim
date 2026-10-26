import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import { loadCatalog } from "./load";
import { computeStats, median, priceHistogram } from "./stats";

describe("median", () => {
  test("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeStats", () => {
  test("counts strictly above 100 €", () => {
    const s = computeStats([product({ price: 100 }), product({ price: 100.01 }), product()]);
    expect(s.over100.count).toBe(1);
  });

  test("averages data over finite offers only and counts unlimited separately", () => {
    const s = computeStats([
      product({ dataGb: 10 }),
      product({ dataGb: 20 }),
      product({ dataGb: null }),
    ]);
    expect(s.data).toEqual({ avgGb: 15, finiteCount: 2, unlimited: 1 });
  });

  test("returns nulls instead of NaN on an empty selection", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.price).toMatchObject({ min: null, max: null, avg: null, median: null });
    expect(s.data.avgGb).toBeNull();
    expect(s.byProvider).toEqual([]);
  });

  test("ranks providers by count and by median €/Go", () => {
    const s = computeStats([
      product({ provider: "B", price: 10, dataGb: 1 }),
      product({ provider: "B", price: 10, dataGb: 1 }),
      product({ provider: "A", price: 10, dataGb: 10 }),
      product({ provider: "C", dataGb: null }),
    ]);
    expect(s.byProvider.map((p) => p.provider)).toEqual(["B", "A", "C"]);
    expect(s.bonus.valueByProvider).toEqual([
      { provider: "A", medianEurPerGb: 1, offers: 1 },
      { provider: "B", medianEurPerGb: 10, offers: 2 },
    ]);
  });

  test("picks the lowest €/Go offer per destination", () => {
    const cheap = product({ countryCode: "JP", countryName: "Japon", price: 20, dataGb: 20 });
    const s = computeStats([
      product({ countryCode: "JP", countryName: "Japon", price: 5, dataGb: 1 }),
      cheap,
      product({ countryCode: "JP", countryName: "Japon", dataGb: null }),
    ]);
    expect(s.bonus.bestDeals[0]).toMatchObject({ countryCode: "JP", offers: 3, eurPerGb: 1 });
    expect(s.bonus.bestDeals[0].best.sku).toBe(cheap.sku);
  });

  test("separates countries from regional pseudo-codes", () => {
    const s = computeStats([
      product({ countryCode: "FR" }),
      product({ countryCode: "EU" }),
      product({ countryCode: "NA" }),
    ]);
    expect(s.bonus.coverage).toEqual({ destinations: 3, countries: 1, regions: 2 });
  });
});

describe("priceHistogram", () => {
  test("10 € bins from 0, upper bound exclusive", () => {
    const bins = priceHistogram([
      product({ price: 5.36 }),
      product({ price: 10 }),
      product({ price: 19.99 }),
    ]);
    expect(bins).toEqual([
      { from: 0, to: 10, count: 1 },
      { from: 10, to: 20, count: 2 },
    ]);
    expect(priceHistogram([])).toEqual([]);
  });

  test("counts every product once on the real catalog", () => {
    const { products } = loadCatalog();
    const bins = priceHistogram(products);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(products.length);
    expect(bins).toHaveLength(16);
  });
});

// Expected figures were measured independently (Python csv module) from the raw archive.
describe("real supplier data", () => {
  const { products, quality } = loadCatalog();
  const s = computeStats(products);

  test("loads every file without rejection", () => {
    expect(quality).toMatchObject({ files: 18, rows: 5056, valid: 5056, rejected: [] });
  });

  test("matches the independently measured headline figures", () => {
    expect(s.total).toBe(5056);
    expect(s.over100.count).toBe(56);
    expect(s.price.min).toBe(5.36);
    expect(s.price.max).toBe(154.63);
    expect(s.price.avg).toBeCloseTo(29.3, 2);
    expect(s.data.avgGb).toBeCloseTo(14.49, 2);
    expect(s.data.unlimited).toBe(653);
    expect(s.byProvider).toHaveLength(18);
    expect(s.byProvider[0]).toMatchObject({ provider: "Airalo", count: 722 });
    expect(s.byProvider.at(-1)).toMatchObject({ provider: "4S eSIM", count: 92 });
    expect(s.bonus.coverage).toEqual({ destinations: 54, countries: 50, regions: 4 });
  });
});
