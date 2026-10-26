import { eurPerGb } from "./stats";
import type { Product } from "./types";

export type SortKey =
  | "name"
  | "provider"
  | "countryName"
  | "dataGb"
  | "validityDays"
  | "price"
  | "eurPerGb";
export type SortDir = "asc" | "desc";

// Unlimited offers sort after every finite volume; their €/Go is undefined, so they sort last.
function sortValue(p: Product, key: SortKey): number | string {
  if (key === "dataGb") return p.dataGb ?? Number.POSITIVE_INFINITY;
  if (key === "eurPerGb") return eurPerGb(p) ?? Number.POSITIVE_INFINITY;
  return p[key];
}

/** Stable sort (ties broken by SKU), French collation for text columns. */
export function sortProducts(products: Product[], key: SortKey, dir: SortDir): Product[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...products].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    const c =
      typeof va === "string"
        ? va.localeCompare(vb as string, "fr")
        : (va as number) - (vb as number);
    return c !== 0 ? c * sign : a.sku.localeCompare(b.sku);
  });
}
