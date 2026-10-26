import { describe, expect, test } from "bun:test";
import { HEADER, product } from "./fixtures";
import { previewImport } from "./import-preview";
import { loadCatalog } from "./load";
import { buildSampleImport, SAMPLE_CHANGES } from "./sample";

describe("previewImport", () => {
  test("replaces only the providers present in the file", () => {
    const current = [
      product({ sku: "a-1", provider: "Airalo", price: 10 }),
      product({ sku: "a-2", provider: "Airalo", price: 10 }),
      product({ sku: "h-1", provider: "Holafly", price: 10 }),
    ];
    const text = [
      HEADER,
      "a-1,Airalo,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,11,EUR,4G,oui",
    ].join("\n");
    const p = previewImport([{ file: "airalo.csv", text }], current);
    expect(p.providers).toEqual(["Airalo"]);
    expect(p.diff.removed.map((x) => x.sku)).toEqual(["a-2"]);
    expect(p.diff.repriced.map((x) => x.after.sku)).toEqual(["a-1"]);
    expect(p.stats.total).toBe(1);
  });

  test("a new provider is all additions", () => {
    const text = [HEADER, "z-1,Zeta,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,9,EUR,4G,oui"].join(
      "\n",
    );
    const p = previewImport([{ file: "zeta.csv", text }], [product()]);
    expect(p.diff.added).toHaveLength(1);
    expect(p.diff.removed).toHaveLength(0);
  });

  test("the built-in sample against the real catalog", () => {
    const { products } = loadCatalog();
    const p = previewImport(
      [{ file: "airalo.csv", text: buildSampleImport(products, "Airalo") }],
      products,
    );
    expect(p.quality.rejected).toHaveLength(SAMPLE_CHANGES.invalid);
    expect(p.diff.added).toHaveLength(SAMPLE_CHANGES.added);
    expect(p.diff.removed).toHaveLength(SAMPLE_CHANGES.removed);
    expect(p.diff.repriced).toHaveLength(SAMPLE_CHANGES.repriced);
    expect(p.guard.ok).toBe(true);
    // Audit entries only concern the imported provider.
    expect(p.audit.outliers.every((o) => o.product.provider === "Airalo")).toBe(true);
    expect(p.audit.dominated.every((d) => d.offer.provider === "Airalo")).toBe(true);
  });

  test("flags what the ingest guard would hold", () => {
    const current = Array.from({ length: 12 }, (_, i) =>
      product({ sku: `a-${i}`, provider: "Airalo", price: 10 }),
    );
    const rows = current.map(
      (p) => `${p.sku},Airalo,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,20,EUR,4G,oui`,
    );
    const p = previewImport([{ file: "airalo.csv", text: [HEADER, ...rows].join("\n") }], current);
    expect(p.guard.ok).toBe(false);
    expect(p.guard.violations[0]).toMatchObject({
      provider: "Airalo",
      kind: "price-moves",
      count: 12,
    });
  });
});
