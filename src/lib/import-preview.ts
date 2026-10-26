import { type Audit, auditCatalog } from "./audit";
import { mergeCatalog } from "./catalog";
import { type CatalogDiff, diffCatalogs } from "./diff";
import { checkGuard, type GuardResult } from "./guard";
import { computeStats, type Stats } from "./stats";
import type { Product, QualityReport } from "./types";

export interface ImportPreview {
  quality: QualityReport;
  /** Providers found in the imported files. */
  providers: string[];
  /** Imported offers against today's offers of the same providers. */
  diff: CatalogDiff;
  /** Anomalies of the imported offers, measured against the catalog as it would be after the import. */
  audit: Audit;
  stats: Stats;
  /** Same price-move guard as the ingest service: a held file would not be published. */
  guard: GuardResult;
}

/**
 * Simulates importing supplier files into the current catalog: the files replace the
 * offers of the providers they contain, every other provider is kept as is.
 */
export function previewImport(
  files: { file: string; text: string }[],
  current: Product[],
): ImportPreview {
  const imported = mergeCatalog(files);
  const providers = [...new Set(imported.products.map((p) => p.provider))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const replaced = new Set(providers);
  const base = current.filter((p) => replaced.has(p.provider));
  const next = [...current.filter((p) => !replaced.has(p.provider)), ...imported.products];
  const mine = (p: Product) => replaced.has(p.provider);
  const full = auditCatalog(next);
  const diff = diffCatalogs(base, imported.products);
  return {
    quality: imported.quality,
    providers,
    diff,
    guard: checkGuard(diff, base),
    audit: {
      duplicates: full.duplicates.filter((d) => mine(d.sample)),
      outliers: full.outliers.filter((o) => mine(o.product)),
      dominated: full.dominated.filter((d) => mine(d.offer)),
    },
    stats: computeStats(imported.products),
  };
}
