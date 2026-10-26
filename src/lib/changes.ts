import type { CatalogDiff, ProviderDiff } from "./diff";
import { formatTier } from "./format";
import type { Product } from "./types";

/** What the dashboard shows under "Depuis le dernier import": small, JSON-friendly. */
export interface ChangeOffer {
  sku: string;
  provider: string;
  label: string;
  price: number;
}

export interface ChangeMove extends ChangeOffer {
  before: number;
  pct: number;
}

export interface ChangesSummary {
  importId: string;
  importedAt: string;
  previousImportId: string | null;
  added: number;
  removed: number;
  up: number;
  down: number;
  modified: number;
  byProvider: ProviderDiff[];
  topMoves: ChangeMove[];
  addedSample: ChangeOffer[];
  removedSample: ChangeOffer[];
}

const label = (p: Product) => `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;
const offer = (p: Product): ChangeOffer => ({
  sku: p.sku,
  provider: p.provider,
  label: label(p),
  price: p.price,
});

export function summarizeChanges(
  diff: CatalogDiff,
  meta: { importId: string; importedAt: string; previousImportId: string | null },
  limit = 8,
): ChangesSummary {
  const up = diff.repriced.filter((c) => c.after.price > c.before.price).length;
  return {
    ...meta,
    added: diff.added.length,
    removed: diff.removed.length,
    up,
    down: diff.repriced.length - up,
    modified: diff.modified.length,
    byProvider: diff.byProvider,
    topMoves: diff.repriced.slice(0, limit).map((c) => ({
      ...offer(c.after),
      before: c.before.price,
      pct: c.pct,
    })),
    addedSample: diff.added.slice(0, limit).map(offer),
    removedSample: diff.removed.slice(0, limit).map(offer),
  };
}
