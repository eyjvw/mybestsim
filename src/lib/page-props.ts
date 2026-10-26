import { auditCatalog } from "./audit";
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
    initialAudit: auditCatalog(products),
    builtAt: BUILD.builtAt,
  };
}

/** Site sections, in navigation order. `filters`: the link keeps the current selection. */
export const SITE_NAV = [
  { href: "/", label: "Vue d'ensemble", filters: true },
  { href: "/analyse", label: "Analyse", filters: true },
  { href: "/offres", label: "Offres", filters: true },
  { href: "/qualite", label: "Qualité", filters: false },
  { href: "/import", label: "Tester un import", filters: false },
  { href: "/blog/internet-croisiere-esim/", label: "Article", filters: false },
] as const;
