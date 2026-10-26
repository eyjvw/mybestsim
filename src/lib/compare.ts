import { groupBy, median } from "./math";
import type { Product } from "./types";

/** Same destination, same data volume, same validity: the unit a comparator ranks. */
export function planKey(p: Pick<Product, "countryCode" | "dataGb" | "validityDays">): string {
  return `${p.countryCode}|${p.dataGb ?? "U"}|${p.validityDays}`;
}

export interface PlanGroup {
  key: string;
  countryCode: string;
  countryName: string;
  dataGb: number | null;
  validityDays: number;
  offers: number;
  providers: number;
  min: number;
  max: number;
  median: number;
  cheapest: Product;
  priciest: Product;
  /** Providers selling this plan at its lowest price (ties included). */
  winners: string[];
}

export interface ProviderWins {
  provider: string;
  wins: number;
  /** Share of the comparable plans this provider sells at the lowest price. */
  share: number;
}

export interface MarketStats {
  plans: number;
  /** Plans sold by at least two distinct providers. */
  comparable: number;
  /** Median, over comparable plans, of (median price − cheapest price). */
  medianSaving: number | null;
  medianSavingPct: number | null;
  biggestGaps: PlanGroup[];
  wins: ProviderWins[];
  /** Median 5G/4G price ratio on plans sold in both networks. */
  networkPremium: { plans: number; medianRatio: number | null };
  /** Offers that no other offer at the same destination beats on every criterion. */
  efficient: { count: number; share: number };
}

const byPrice = (a: Product, b: Product) => a.price - b.price || a.sku.localeCompare(b.sku);

function toGroup(key: string, list: Product[]): PlanGroup {
  const sorted = [...list].sort(byPrice);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    key,
    countryCode: first.countryCode,
    countryName: first.countryName,
    dataGb: first.dataGb,
    validityDays: first.validityDays,
    offers: sorted.length,
    providers: new Set(sorted.map((p) => p.provider)).size,
    min: first.price,
    max: last.price,
    median: median(sorted.map((p) => p.price)) as number,
    cheapest: first,
    priciest: last,
    winners: [...new Set(sorted.filter((p) => p.price === first.price).map((p) => p.provider))],
  };
}

export function groupPlans(products: Product[]): PlanGroup[] {
  return [...groupBy(products, planKey)].map(([key, list]) => toGroup(key, list));
}

const volume = (p: Product) => p.dataGb ?? Number.POSITIVE_INFINITY;

/**
 * `b` dominates `a` when it is strictly cheaper and at least as good on everything a
 * traveller compares: data, validity, network and top-up. Destination is the caller's job.
 */
export function dominates(b: Product, a: Product): boolean {
  return (
    b.price < a.price &&
    volume(b) >= volume(a) &&
    b.validityDays >= a.validityDays &&
    (b.network === "5G" || a.network === "4G") &&
    (b.topUp || !a.topUp)
  );
}

/** `b` dominates `a` and is strictly better on at least one criterion, not just a cheaper copy. */
export function dominatesWithBetterSpec(b: Product, a: Product): boolean {
  return (
    dominates(b, a) &&
    (volume(b) > volume(a) ||
      b.validityDays > a.validityDays ||
      (b.network === "5G" && a.network === "4G") ||
      (b.topUp && !a.topUp))
  );
}

/** For each dominated offer of `pool`, the cheapest offer of the same pool that dominates it. */
export function dominatedOffers(
  pool: Product[],
  beats: (b: Product, a: Product) => boolean = dominates,
): { offer: Product; by: Product }[] {
  const sorted = [...pool].sort(byPrice);
  const out: { offer: Product; by: Product }[] = [];
  for (const a of sorted) {
    // Sorted by price, so the first dominating offer found is the cheapest one.
    const by = sorted.find((b) => beats(b, a));
    if (by) out.push({ offer: a, by });
  }
  return out;
}

export function computeMarket(products: Product[], gapsLimit = 8): MarketStats {
  const plans = groupBy(products, planKey);
  const groups = [...plans].map(([key, list]) => toGroup(key, list));
  const comparable = groups.filter((g) => g.providers >= 2);

  const winCount = new Map<string, number>();
  for (const g of comparable) {
    for (const w of g.winners) winCount.set(w, (winCount.get(w) ?? 0) + 1);
  }
  const wins = [...winCount]
    .map(([provider, n]) => ({ provider, wins: n, share: n / comparable.length }))
    .sort((a, b) => b.wins - a.wins || a.provider.localeCompare(b.provider, "fr"));

  const ratios: number[] = [];
  for (const list of plans.values()) {
    const p4 = list.filter((p) => p.network === "4G").map((p) => p.price);
    const p5 = list.filter((p) => p.network === "5G").map((p) => p.price);
    if (p4.length && p5.length) ratios.push((median(p5) as number) / (median(p4) as number));
  }

  let efficient = 0;
  for (const list of groupBy(products, (p) => p.countryCode).values()) {
    efficient += list.length - dominatedOffers(list).length;
  }

  return {
    plans: groups.length,
    comparable: comparable.length,
    medianSaving: median(comparable.map((g) => g.median - g.min)),
    medianSavingPct: median(comparable.map((g) => (g.median - g.min) / g.median)),
    biggestGaps: [...comparable]
      .sort((a, b) => b.max - b.min - (a.max - a.min) || a.key.localeCompare(b.key))
      .slice(0, gapsLimit),
    wins,
    networkPremium: { plans: ratios.length, medianRatio: median(ratios) },
    efficient: { count: efficient, share: products.length ? efficient / products.length : 0 },
  };
}
