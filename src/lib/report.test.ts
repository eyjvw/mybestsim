import { describe, expect, test } from "bun:test";
import { auditCatalog } from "./audit";
import { diffCatalogs } from "./diff";
import { product } from "./fixtures";
import { REPORT_MARKER, renderDataReport } from "./report";
import type { QualityReport } from "./types";

const quality = (rejected: QualityReport["rejected"] = []): QualityReport => ({
  files: 1,
  rows: 3,
  valid: 3 - rejected.length,
  rejected,
  perFile: [],
});

describe("renderDataReport", () => {
  const before = [product({ sku: "a", price: 10 }), product({ sku: "b" })];
  const after = [product({ sku: "a", price: 12 }), product({ sku: "c", countryCode: "JP" })];
  const diff = diffCatalogs(before, after);

  test("starts with the marker CI uses to update its comment", () => {
    const md = renderDataReport({
      quality: quality(),
      diff,
      audit: auditCatalog(after),
      baseTotal: 2,
      headTotal: 2,
    });
    expect(md.startsWith(REPORT_MARKER)).toBe(true);
    expect(md).toContain("✅ **Schéma valide**");
    expect(md).toContain("| Offres | 2 | 2 | 1 | 1 | 1 | 0 | 0 |");
    expect(md).toContain("3 lignes lues dans 1 fichier, 0 rejet");
    expect(md.replace(/[\u202f\u00a0]/g, " ")).toContain("+2,00 € (+20 %)");
    expect(md).toContain("Aucune anomalie détectée.");
  });

  test("lists rejected rows and escapes pipes", () => {
    const md = renderDataReport({
      quality: quality([{ file: "x.csv", line: 4, reason: "price : a|b" }]),
      diff,
      audit: auditCatalog(after),
      baseTotal: 2,
      headTotal: 2,
    });
    expect(md).toContain("❌ **1 ligne rejetée**");
    expect(md).toContain("| `x.csv` | 4 | price : a\\|b |");
  });

  test("caps detail tables", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ file: "x.csv", line: i + 2, reason: "r" }));
    const md = renderDataReport({
      quality: quality(many),
      diff,
      audit: auditCatalog(after),
      baseTotal: 2,
      headTotal: 2,
      limit: 2,
    });
    expect(md).toContain("3 autres");
  });

  test("reports a guard hold", () => {
    const md = renderDataReport({
      quality: quality(),
      diff,
      audit: auditCatalog(after),
      baseTotal: 2,
      headTotal: 2,
      guard: {
        ok: false,
        violations: [{ provider: "Airalo", kind: "price-moves", count: 9, base: 20, share: 0.45 }],
      },
    });
    expect(md).toContain("Garde-fou : import retenu");
    expect(md.replace(/[\u202f\u00a0]/g, " ")).toContain("**Airalo** : 9 prix sur 20 (45 %)");
  });
});
