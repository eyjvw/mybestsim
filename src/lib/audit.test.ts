import { describe, expect, test } from "bun:test";
import {
  AUDIT_SHOWN,
  auditCatalog,
  dominatedWithinProvider,
  flaggedCount,
  functionalDuplicates,
  priceOutliers,
  summarizeAudit,
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

  test("its summary keeps the counts and the first rows of each check", () => {
    const s = summarizeAudit(audit);
    expect(s.duplicates).toMatchObject({ count: 219, skus: 458 });
    expect(s.duplicates.top).toEqual(audit.duplicates.slice(0, AUDIT_SHOWN));
    expect(s.outliers).toMatchObject({ count: 8, top: audit.outliers.slice(0, AUDIT_SHOWN) });
    expect(s.dominated).toMatchObject({ count: 351, top: audit.dominated.slice(0, AUDIT_SHOWN) });
    expect(flaggedCount(s)).toBe(219 + 8 + 351);
    // The point of the summary: a few kilobytes in each page instead of hundreds.
    expect(JSON.stringify(s).length).toBeLessThan(JSON.stringify(audit).length / 20);
  });
});

describe("summarizeAudit", () => {
  test("an empty audit has zero counts and no rows", () => {
    const s = summarizeAudit({ duplicates: [], outliers: [], dominated: [] });
    expect(s).toEqual({
      duplicates: { count: 0, skus: 0, top: [] },
      outliers: { count: 0, top: [] },
      dominated: { count: 0, top: [] },
    });
    expect(flaggedCount(s)).toBe(0);
  });

  test("keeps at most `shown` rows", () => {
    const dups = functionalDuplicates([
      product({ sku: "a-1", price: 10 }),
      product({ sku: "a-2", price: 12 }),
      product({ sku: "b-1", price: 10, validityDays: 30 }),
      product({ sku: "b-2", price: 11, validityDays: 30 }),
    ]);
    const s = summarizeAudit({ duplicates: dups, outliers: [], dominated: [] }, 1);
    expect(s.duplicates).toMatchObject({ count: 2, skus: 4 });
    expect(s.duplicates.top).toHaveLength(1);
  });
});
