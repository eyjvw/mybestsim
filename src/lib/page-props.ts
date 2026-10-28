import { auditCatalog, summarizeAudit } from "./audit";
import { BUILD } from "./build-info";
import { filterOptions } from "./filters";
import { loadCatalog } from "./load";
import { sortProducts } from "./sort";
import { computeStats } from "./stats";

/** Build-time props shared by every dashboard page (first paint before the live data loads). */
export function dashboardProps() {
  const { products, quality } = loadCatalog();
  return {
    initialStats: computeStats(products),
    initialRows: sortProducts(products, "price", "asc").slice(0, 15),
    options: filterOptions(products),
    initialQuality: quality,
    initialAudit: summarizeAudit(auditCatalog(products)),
    builtAt: BUILD.builtAt,
  };
}

/**
 * Site sections, in navigation order. `filters`: the link keeps the current selection;
 * `sandbox`: the page can show the sandbox's data, so the link keeps `?bac=1`.
 */
export const SITE_NAV = [
  { href: "/", label: "Accueil", filters: true, sandbox: true },
  { href: "/analyse", label: "Analyse", filters: true, sandbox: true },
  { href: "/offres", label: "Offres", filters: true, sandbox: true },
  { href: "/qualite", label: "Qualité", filters: false, sandbox: true },
  { href: "/import", label: "Import", filters: false, sandbox: true },
  { href: "/blog/internet-croisiere-esim/", label: "Article", filters: false, sandbox: false },
] as const;
