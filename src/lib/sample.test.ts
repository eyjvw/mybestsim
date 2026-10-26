import { describe, expect, test } from "bun:test";
import { parseSupplierCsv } from "./catalog";
import { diffCatalogs } from "./diff";
import { product } from "./fixtures";
import { loadCatalog } from "./load";
import { buildSampleImport, SAMPLE_CHANGES } from "./sample";

describe("buildSampleImport", () => {
  const { products } = loadCatalog();
  const csv = buildSampleImport(products, "Airalo");
  const parsed = parseSupplierCsv(csv, "airalo.csv");
  const today = products.filter((p) => p.provider === "Airalo");
  const diff = diffCatalogs(today, parsed.products);

  test("is deterministic", () => {
    expect(buildSampleImport(products, "Airalo")).toBe(csv);
  });

  test("produces exactly the announced changes", () => {
    expect(parsed.rejected).toHaveLength(SAMPLE_CHANGES.invalid);
    expect(diff.removed).toHaveLength(SAMPLE_CHANGES.removed);
    expect(diff.repriced).toHaveLength(SAMPLE_CHANGES.repriced);
    expect(diff.added).toHaveLength(SAMPLE_CHANGES.added);
    expect(diff.modified).toHaveLength(0);
  });

  test("rejects the invalid rows for the expected reasons", () => {
    const reasons = parsed.rejected.map((r) => r.reason).join(" | ");
    expect(reasons).toContain("devise");
    expect(reasons).toContain("price");
  });

  test("works for the smallest provider and refuses a tiny one", () => {
    expect(() => buildSampleImport(products, "4S eSIM")).not.toThrow();
    expect(() => buildSampleImport([product()], "Airalo")).toThrow();
  });
});
