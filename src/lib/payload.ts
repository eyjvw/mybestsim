import { auditCatalog } from "./audit";
import { computeStats } from "./stats";
import type { Product, QualityReport } from "./types";

/** Body of stats.json, built the same way at build time and by the ingest service. */
export function statsPayload(products: Product[], quality: QualityReport, generatedAt: string) {
  const audit = auditCatalog(products);
  return {
    generatedAt,
    ...computeStats(products),
    quality,
    audit: {
      duplicates: { groups: audit.duplicates.length, maxRatio: audit.duplicates[0]?.ratio ?? null },
      outliers: audit.outliers.map((o) => ({
        sku: o.product.sku,
        price: o.product.price,
        median: o.median,
      })),
      dominatedWithinProvider: audit.dominated.length,
    },
  };
}
