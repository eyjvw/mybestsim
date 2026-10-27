import { type AuditSummary, auditCatalog, summarizeAudit } from "./audit";
import { type FilterOptions, filterOptions } from "./filters";
import { type LiveCatalog, loadCatalog } from "./runtime";
import { computeStats, type Stats } from "./stats";
import type { Product } from "./types";

/**
 * The live catalog is loaded in a Web Worker: fetching 1 MB of JSON, then the stats and the
 * audit over 5,000 offers, blocked the main thread for 100 to 300 ms on a mid-range phone.
 * This module is the worker's side; `live-client.ts` is the page's.
 */

/** What the dashboard shows of the whole catalog before any filter, computed once. */
export interface CatalogSummary {
  stats: Stats;
  audit: AuditSummary;
  options: FilterOptions;
}

export function summarizeCatalog(products: Product[]): CatalogSummary {
  return {
    stats: computeStats(products),
    audit: summarizeAudit(auditCatalog(products)),
    options: filterOptions(products),
  };
}

export interface LiveRequest {
  /** Where the release lives: production's /data or the sandbox's. */
  base: string;
}

/**
 * The products travel as JSON text: a string is cheap to post, and JSON.parse is the fastest way
 * for the page to rebuild 5,000 objects.
 */
export type LiveReply =
  | {
      ok: true;
      catalog: Omit<LiveCatalog, "products" | "summary">;
      products: string;
      summary: CatalogSummary;
    }
  | { ok: false };

type Fetch = (url: string) => Promise<Response>;

export async function answer(req: LiveRequest, fetchFn?: Fetch): Promise<LiveReply> {
  try {
    const { products, ...catalog } = await loadCatalog(fetchFn, req.base);
    return {
      ok: true,
      catalog,
      products: JSON.stringify(products),
      summary: summarizeCatalog(products),
    };
  } catch {
    return { ok: false };
  }
}
