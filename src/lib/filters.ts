import { isRegion } from "./regions";
import type { Network, Product } from "./types";

export { isRegion };

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

export interface FilterOptions {
  providers: string[];
  destinations: { code: string; name: string; region: boolean }[];
}

/** Choices offered by the filter bar, derived from the catalog actually shown. */
export function filterOptions(products: Product[]): FilterOptions {
  const destinations = [...new Map(products.map((p) => [p.countryCode, p.countryName])).entries()]
    .map(([code, name]) => ({ code, name, region: isRegion(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr") || a.code.localeCompare(b.code));
  const providers = [...new Set(products.map((p) => p.provider))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  return { providers, destinations };
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  return products.filter((p) => matches(p, f));
}

export function activeFilterCount(f: Filters): number {
  return Object.entries(f).filter(([k, v]) => v !== DEFAULT_FILTERS[k as keyof Filters]).length;
}

/** Query-string keys, short and stable so a shared link stays readable. */
const PARAMS = {
  provider: "fournisseur",
  zone: "zone",
  destination: "destination",
  network: "reseau",
  validity: "duree",
  data: "data",
  topUp: "recharge",
} as const satisfies Record<keyof Filters, string>;

export function filtersToSearch(f: Filters): string {
  const q = new URLSearchParams();
  for (const key of Object.keys(PARAMS) as (keyof Filters)[]) {
    if (f[key] !== DEFAULT_FILTERS[key]) q.set(PARAMS[key], String(f[key]));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface FilterDomain {
  providers: readonly string[];
  destinations: readonly string[];
  validities: readonly number[];
  dataTiers: readonly (number | null)[];
}

/** Reads filters from a query string. Unknown or invalid values fall back to "all". */
export function filtersFromSearch(search: string, domain: FilterDomain): Filters {
  const q = new URLSearchParams(search);
  const get = (key: keyof Filters) => q.get(PARAMS[key]);
  const f: Filters = { ...DEFAULT_FILTERS };

  const provider = get("provider");
  if (provider && domain.providers.includes(provider)) f.provider = provider;
  const zone = get("zone");
  if (zone === "country" || zone === "region") f.zone = zone;
  const destination = get("destination");
  if (destination && domain.destinations.includes(destination)) f.destination = destination;
  const network = get("network");
  if (network === "4G" || network === "5G") f.network = network;
  const validity = Number(get("validity"));
  if (domain.validities.includes(validity)) f.validity = validity;
  const data = get("data");
  if (data === "unlimited") f.data = "unlimited";
  else if (data && domain.dataTiers.includes(Number(data))) f.data = Number(data);
  const topUp = get("topUp");
  if (topUp === "yes" || topUp === "no") f.topUp = topUp;

  // A destination outside the chosen zone would silently empty every view.
  if (
    f.destination !== "all" &&
    f.zone !== "all" &&
    isRegion(f.destination) !== (f.zone === "region")
  ) {
    f.destination = "all";
  }
  return f;
}
