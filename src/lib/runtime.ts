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

/** Where the ingest service publishes: production, or the public sandbox (reset every night). */
export const LIVE_DATA = "/data";
export const SANDBOX_DATA = "/sandbox/data";
/** `?bac=1` shows the sandbox's data instead of production's, on every page. */
export const SANDBOX_PARAM = "bac";

export const isSandbox = (search: string): boolean =>
  new URLSearchParams(search).get(SANDBOX_PARAM) === "1";

/** `search` with the sandbox flag set or removed, other parameters untouched. */
export function withSandbox(search: string, on: boolean): string {
  const params = new URLSearchParams(search);
  if (on) params.set(SANDBOX_PARAM, "1");
  else params.delete(SANDBOX_PARAM);
  const out = params.toString();
  return out ? `?${out}` : "";
}

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
  base: string = LIVE_DATA,
): Promise<LiveCatalog> {
  // version.json first: a static build ships a placeholder without importId, so the
  // other live files are only requested when a release really exists.
  const version = await getJson<Partial<LiveVersion>>(fetchFn, `${base}/version.json`);
  if (version?.importId) {
    const [live, changes] = await Promise.all([
      getJson<{ products: Product[] }>(fetchFn, `${base}/catalog.json`),
      getJson<ChangesSummary | null>(fetchFn, `${base}/changes.json`),
    ]);
    if (live?.products) {
      return { products: live.products, source: "live", version: version as LiveVersion, changes };
    }
  }
  const snapshot = await getJson<{ products: Product[] }>(fetchFn, "/catalog.json");
  if (!snapshot?.products) throw new Error("catalogue introuvable");
  return { products: snapshot.products, source: "build", version: null, changes: null };
}
