import { dominatedOffers, dominatesWithBetterSpec, planKey } from "./compare";
import { groupBy, median } from "./math";
import type { Product } from "./types";

/**
 * Checks a valid catalog for business anomalies. None of them rejects a row: they are
 * signals for whoever reviews the import, shown next to the schema report.
 */

/** Same provider, same plan, same network and top-up, listed under several SKUs. */
export interface DuplicateGroup {
  provider: string;
  sample: Product;
  skus: string[];
  min: number;
  max: number;
  /** max / min price. */
  ratio: number;
}

export interface PriceOutlier {
  product: Product;
  /** Median price of the same plan across the catalog. */
  median: number;
  /** price / median − 1. */
  deviation: number;
  peers: number;
}

export interface Dominated {
  offer: Product;
  /**
   * Cheaper offer of the same provider and destination, at least as good on every criterion
   * and strictly better on one (exact copies are reported as duplicates instead).
   */
  by: Product;
}

export interface Audit {
  duplicates: DuplicateGroup[];
  outliers: PriceOutlier[];
  dominated: Dominated[];
}

export const OUTLIER_THRESHOLD = 0.25;
export const OUTLIER_MIN_PEERS = 4;

const duplicateKey = (p: Product) => `${p.provider}|${planKey(p)}|${p.network}|${p.topUp}`;

export function functionalDuplicates(products: Product[]): DuplicateGroup[] {
  return [...groupBy(products, duplicateKey).values()]
    .filter((list) => list.length > 1)
    .map((list) => {
      const prices = list.map((p) => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return {
        provider: list[0].provider,
        sample: list[0],
        skus: list.map((p) => p.sku).sort(),
        min,
        max,
        ratio: max / min,
      };
    })
    .sort((a, b) => b.ratio - a.ratio || a.skus[0].localeCompare(b.skus[0]));
}

/** Prices at least `threshold` away from the median of the same plan, when it has enough offers. */
export function priceOutliers(
  products: Product[],
  threshold = OUTLIER_THRESHOLD,
  minPeers = OUTLIER_MIN_PEERS,
): PriceOutlier[] {
  const out: PriceOutlier[] = [];
  for (const list of groupBy(products, planKey).values()) {
    if (list.length < minPeers) continue;
    const m = median(list.map((p) => p.price)) as number;
    for (const p of list) {
      const deviation = p.price / m - 1;
      if (Math.abs(deviation) >= threshold) {
        out.push({ product: p, median: m, deviation, peers: list.length });
      }
    }
  }
  return out.sort(
    (a, b) =>
      Math.abs(b.deviation) - Math.abs(a.deviation) || a.product.sku.localeCompare(b.product.sku),
  );
}

/** Offers a provider's own range makes pointless: a cheaper offer of theirs gives more. */
export function dominatedWithinProvider(products: Product[]): Dominated[] {
  const out: Dominated[] = [];
  for (const list of groupBy(products, (p) => `${p.provider}|${p.countryCode}`).values()) {
    out.push(...dominatedOffers(list, dominatesWithBetterSpec));
  }
  return out.sort(
    (a, b) =>
      b.offer.price - b.by.price - (a.offer.price - a.by.price) ||
      a.offer.sku.localeCompare(b.offer.sku),
  );
}

export function auditCatalog(products: Product[]): Audit {
  return {
    duplicates: functionalDuplicates(products),
    outliers: priceOutliers(products),
    dominated: dominatedWithinProvider(products),
  };
}

/**
 * What the pages show of an audit: each check's count and its first rows. A few kilobytes,
 * where the full audit (every flagged offer) weighed 300 KB in each dashboard page.
 */
export interface AuditSummary {
  duplicates: { count: number; skus: number; top: DuplicateGroup[] };
  outliers: { count: number; top: PriceOutlier[] };
  dominated: { count: number; top: Dominated[] };
}

/** Rows shown per check on /qualite. */
export const AUDIT_SHOWN = 5;

export function summarizeAudit(audit: Audit, shown = AUDIT_SHOWN): AuditSummary {
  return {
    duplicates: {
      count: audit.duplicates.length,
      skus: audit.duplicates.reduce((n, d) => n + d.skus.length, 0),
      top: audit.duplicates.slice(0, shown),
    },
    outliers: { count: audit.outliers.length, top: audit.outliers.slice(0, shown) },
    dominated: { count: audit.dominated.length, top: audit.dominated.slice(0, shown) },
  };
}

export const flaggedCount = (s: AuditSummary) =>
  s.duplicates.count + s.outliers.count + s.dominated.count;
