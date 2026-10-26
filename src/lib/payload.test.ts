import { describe, expect, test } from "bun:test";
import { loadCatalog } from "./load";
import { statsPayload } from "./payload";

describe("statsPayload", () => {
  test("stats, quality and the audit summary in one object", () => {
    const { products, quality } = loadCatalog();
    const p = statsPayload(products, quality, "2026-10-26T00:00:00.000Z");
    expect(p.generatedAt).toBe("2026-10-26T00:00:00.000Z");
    expect(p.total).toBe(5056);
    expect(p.quality.rejected).toEqual([]);
    expect(p.audit.duplicates.groups).toBe(219);
    expect(p.audit.dominatedWithinProvider).toBe(351);
    expect(p.audit.outliers).toHaveLength(8);
  });
});
