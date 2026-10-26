import type { ChangesSummary } from "./changes";
import type { Product, QualityReport } from "./types";

/**
 * Live data: published by the ingest service under /data, no rebuild needed. When it is
 * not there (static hosting, local dev) the build snapshot (/catalog.json) is used.
 */
export interface LiveVersion {
  importId: string;
  importedAt: string;
  previousImportId: string | null;
  source: "seed" | "api" | "inbox";
  files: string[];
  quality: QualityReport;
}

export interface LiveCatalog {
  products: Product[];
  source: "live" | "build";
  version: LiveVersion | null;
  changes: ChangesSummary | null;
}

type Fetch = (url: string) => Promise<Response>;

async function getJson<T>(fetchFn: Fetch, url: string): Promise<T | null> {
  try {
    const r = await fetchFn(url);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function loadCatalog(
  fetchFn: Fetch = (u) => fetch(u, { cache: "no-cache" }),
): Promise<LiveCatalog> {
  // version.json first: a static build ships a placeholder without importId, so the
  // other live files are only requested when a release really exists.
  const version = await getJson<Partial<LiveVersion>>(fetchFn, "/data/version.json");
  if (version?.importId) {
    const [live, changes] = await Promise.all([
      getJson<{ products: Product[] }>(fetchFn, "/data/catalog.json"),
      getJson<ChangesSummary | null>(fetchFn, "/data/changes.json"),
    ]);
    if (live?.products) {
      return { products: live.products, source: "live", version: version as LiveVersion, changes };
    }
  }
  const snapshot = await getJson<{ products: Product[] }>(fetchFn, "/catalog.json");
  if (!snapshot?.products) throw new Error("catalogue introuvable");
  return { products: snapshot.products, source: "build", version: null, changes: null };
}
