import { REGION_CODES } from "./stats";
import type { Network, Product } from "./types";

export type All = "all";

export interface Filters {
  provider: string | All;
  zone: "country" | "region" | All;
  destination: string | All;
  network: Network | All;
  validity: number | All;
  /** A data tier in GB, `"unlimited"`, or `"all"`. */
  data: number | "unlimited" | All;
  topUp: "yes" | "no" | All;
}

export const DEFAULT_FILTERS: Filters = {
  provider: "all",
  zone: "all",
  destination: "all",
  network: "all",
  validity: "all",
  data: "all",
  topUp: "all",
};

export function isRegion(countryCode: string): boolean {
  return REGION_CODES.has(countryCode);
}

export function matches(p: Product, f: Filters): boolean {
  if (f.provider !== "all" && p.provider !== f.provider) return false;
  if (f.zone !== "all" && (f.zone === "region") !== isRegion(p.countryCode)) return false;
  if (f.destination !== "all" && p.countryCode !== f.destination) return false;
  if (f.network !== "all" && p.network !== f.network) return false;
  if (f.validity !== "all" && p.validityDays !== f.validity) return false;
  if (f.data === "unlimited" && p.dataGb !== null) return false;
  if (typeof f.data === "number" && p.dataGb !== f.data) return false;
  if (f.topUp !== "all" && p.topUp !== (f.topUp === "yes")) return false;
  return true;
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  return products.filter((p) => matches(p, f));
}

export function activeFilterCount(f: Filters): number {
  return Object.entries(f).filter(([k, v]) => v !== DEFAULT_FILTERS[k as keyof Filters]).length;
}
