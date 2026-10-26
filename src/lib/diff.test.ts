import { describe, expect, test } from "bun:test";
import { diffCatalogs, hasChanges } from "./diff";
import { product } from "./fixtures";

describe("diffCatalogs", () => {
  const kept = product({ sku: "k", price: 10 });
  const up = product({ sku: "u", price: 10 });
  const down = product({ sku: "d", price: 20, provider: "B" });
  const renamed = product({ sku: "r", price: 5 });
  const gone = product({ sku: "g" });
  const base = [kept, up, down, renamed, gone];
  const head = [
    kept,
    { ...up, price: 12.5 },
    { ...down, price: 15 },
    { ...renamed, dataGb: 10 },
    product({ sku: "n", provider: "B" }),
  ];
  const d = diffCatalogs(base, head);

  test("matches offers by SKU", () => {
    expect(d.added.map((p) => p.sku)).toEqual(["n"]);
    expect(d.removed.map((p) => p.sku)).toEqual(["g"]);
    expect(d.unchanged).toBe(1);
  });

  test("price changes, biggest relative change first", () => {
    expect(d.repriced.map((c) => [c.after.sku, c.delta])).toEqual([
      ["d", -5],
      ["u", 2.5],
    ]);
    expect(d.repriced[1].pct).toBeCloseTo(0.25, 6);
  });

  test("description changes are reported apart from price", () => {
    expect(d.modified).toHaveLength(1);
    expect(d.modified[0].fields).toEqual(["dataGb"]);
  });

  test("per-provider counts", () => {
    expect(d.byProvider).toEqual([
      { provider: "Airalo", added: 0, removed: 1, up: 1, down: 0, modified: 1 },
      { provider: "B", added: 1, removed: 0, up: 0, down: 1, modified: 0 },
    ]);
  });

  test("identical catalogs have no change", () => {
    expect(hasChanges(diffCatalogs(base, base))).toBe(false);
    expect(hasChanges(d)).toBe(true);
  });
});
