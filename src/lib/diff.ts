import type { Product } from "./types";

/** What changed between two imports, matched by SKU. */

export interface PriceChange {
  before: Product;
  after: Product;
  delta: number;
  /** after / before − 1. */
  pct: number;
}

export interface FieldChange {
  before: Product;
  after: Product;
  fields: (keyof Product)[];
}

export interface ProviderDiff {
  provider: string;
  added: number;
  removed: number;
  up: number;
  down: number;
  modified: number;
}

export interface CatalogDiff {
  added: Product[];
  removed: Product[];
  /** Sorted by absolute relative change, biggest first. */
  repriced: PriceChange[];
  /** Offers whose description changed (data, validity, network…), price aside. */
  modified: FieldChange[];
  unchanged: number;
  byProvider: ProviderDiff[];
}

const COMPARED: readonly (keyof Product)[] = [
  "provider",
  "name",
  "countryCode",
  "countryName",
  "dataGb",
  "validityDays",
  "network",
  "topUp",
];

export function diffCatalogs(base: Product[], head: Product[]): CatalogDiff {
  const before = new Map(base.map((p) => [p.sku, p]));
  const after = new Map(head.map((p) => [p.sku, p]));
  const added = head.filter((p) => !before.has(p.sku));
  const removed = base.filter((p) => !after.has(p.sku));
  const repriced: PriceChange[] = [];
  const modified: FieldChange[] = [];
  let unchanged = 0;

  for (const a of head) {
    const b = before.get(a.sku);
    if (!b) continue;
    const fields = COMPARED.filter((k) => a[k] !== b[k]);
    const priceChanged = a.price !== b.price;
    if (priceChanged) {
      const delta = Math.round((a.price - b.price) * 100) / 100;
      repriced.push({ before: b, after: a, delta, pct: a.price / b.price - 1 });
    }
    if (fields.length > 0) modified.push({ before: b, after: a, fields });
    if (!priceChanged && fields.length === 0) unchanged += 1;
  }
  repriced.sort(
    (x, y) => Math.abs(y.pct) - Math.abs(x.pct) || x.after.sku.localeCompare(y.after.sku),
  );

  const providers = new Map<string, ProviderDiff>();
  const entry = (provider: string) => {
    let d = providers.get(provider);
    if (!d) {
      d = { provider, added: 0, removed: 0, up: 0, down: 0, modified: 0 };
      providers.set(provider, d);
    }
    return d;
  };
  for (const p of added) entry(p.provider).added += 1;
  for (const p of removed) entry(p.provider).removed += 1;
  for (const c of repriced)
    entry(c.after.provider)[c.after.price > c.before.price ? "up" : "down"] += 1;
  for (const c of modified) entry(c.after.provider).modified += 1;

  return {
    added,
    removed,
    repriced,
    modified,
    unchanged,
    byProvider: [...providers.values()].sort((a, b) => a.provider.localeCompare(b.provider, "fr")),
  };
}

export const hasChanges = (d: CatalogDiff) =>
  d.added.length + d.removed.length + d.repriced.length + d.modified.length > 0;
