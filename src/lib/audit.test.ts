import { describe, expect, test } from "bun:test";
import {
  auditCatalog,
  dominatedWithinProvider,
  functionalDuplicates,
  priceOutliers,
} from "./audit";
import { product } from "./fixtures";
import { loadCatalog } from "./load";

describe("functionalDuplicates", () => {
  test("same provider, plan, network and top-up under two SKUs", () => {
    const dups = functionalDuplicates([
      product({ sku: "a-2", price: 12 }),
      product({ sku: "a-1", price: 10 }),
      product({ sku: "a-3", price: 10, network: "5G" }),
      product({ sku: "b-1", provider: "B", price: 10 }),
    ]);
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ provider: "Airalo", skus: ["a-1", "a-2"], min: 10, max: 12 });
    expect(dups[0].ratio).toBeCloseTo(1.2, 6);
  });
});

describe("priceOutliers", () => {
  const plan = (price: number, sku: string) => product({ sku, price });

  test("flags prices 25 % or more from the plan median", () => {
    const out = priceOutliers([
      plan(10, "a"),
      plan(10, "b"),
      plan(10, "c"),
      plan(12.5, "d"),
      plan(7.4, "e"),
    ]);
    expect(out.map((o) => o.product.sku)).toEqual(["e", "d"]);
    expect(out[1]).toMatchObject({ median: 10, peers: 5 });
    expect(out[1].deviation).toBeCloseTo(0.25, 6);
  });

  test("ignores plans with fewer than 4 offers", () => {
    expect(priceOutliers([plan(10, "a"), plan(10, "b"), plan(40, "c")])).toEqual([]);
  });
});

describe("dominatedWithinProvider", () => {
  test("only compares offers of the same provider and destination", () => {
    const small = product({ sku: "s", price: 20, dataGb: 5 });
    const big = product({ sku: "b", price: 15, dataGb: 10 });
    const other = product({ sku: "o", provider: "B", price: 1, dataGb: 50 });
    const abroad = product({ sku: "j", countryCode: "JP", price: 1, dataGb: 50 });
    const out = dominatedWithinProvider([small, big, other, abroad]);
    expect(out.map((d) => [d.offer.sku, d.by.sku])).toEqual([["s", "b"]]);
  });

  test("a cheaper exact copy is a duplicate, not a range incoherence", () => {
    const copy = product({ sku: "c1", price: 9 });
    const pricey = product({ sku: "c2", price: 12 });
    expect(dominatedWithinProvider([copy, pricey])).toEqual([]);
    expect(functionalDuplicates([copy, pricey])).toHaveLength(1);
  });
});

// Figures measured independently with Python from the raw CSV files.
describe("real catalog", () => {
  const audit = auditCatalog(loadCatalog().products);

  test("duplicates and dominated offers", () => {
    expect(audit.duplicates).toHaveLength(219);
    expect(audit.duplicates[0].ratio).toBeCloseTo(1.46, 2);
    expect(audit.dominated).toHaveLength(351);
  });

  test("every flagged price deviates by at least 25 %", () => {
    expect(audit.outliers.length).toBeGreaterThan(0);
    for (const o of audit.outliers) expect(Math.abs(o.deviation)).toBeGreaterThanOrEqual(0.25);
  });
});
