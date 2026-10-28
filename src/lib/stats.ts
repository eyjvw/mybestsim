import { computeMarket, type MarketStats } from "./compare";
import { groupBy, mean, median } from "./math";
import { computeOpportunities, type Opportunities } from "./opportunities";
import { REGION_CODES } from "./regions";
import type { Network, Product } from "./types";

export { median };
export const DATA_TIERS: readonly (number | null)[] = [1, 3, 5, 10, 20, 50, null];
export const VALIDITIES: readonly number[] = [7, 15, 30];
export const PRICE_THRESHOLD = 100;

export interface Share<K> {
  key: K;
  count: number;
  share: number;
}

export interface ProviderCount {
  provider: string;
  count: number;
  share: number;
}

export interface ProviderValue {
  provider: string;
  medianEurPerGb: number;
  offers: number;
}

export interface TierPrice {
  dataGb: number | null;
  median: number;
  count: number;
}

export interface BestDeal {
  countryCode: string;
  countryName: string;
  offers: number;
  best: Product;
  eurPerGb: number;
}

export interface HistogramBin {
  /** Inclusive lower bound, in EUR. */
  from: number;
  /** Exclusive upper bound, in EUR. */
  to: number;
  count: number;
}

export const HISTOGRAM_STEP = 10;

/** Price distribution in fixed-width bins, from 0 to the first bound above the highest price. */
export function priceHistogram(products: Product[], step = HISTOGRAM_STEP): HistogramBin[] {
  if (products.length === 0) return [];
  const max = Math.max(...products.map((p) => p.price));
  const bins = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => ({
    from: i * step,
    to: (i + 1) * step,
    count: 0,
  }));
  for (const p of products) bins[Math.floor(p.price / step)].count += 1;
  return bins;
}

export interface Stats {
  total: number;
  over100: { count: number; share: number };
  price: {
    min: number | null;
    max: number | null;
    avg: number | null;
    median: number | null;
    cheapest: Product | null;
    priciest: Product | null;
  };
  data: { avgGb: number | null; finiteCount: number; unlimited: number };
  byProvider: ProviderCount[];
  bonus: {
    valueByProvider: ProviderValue[];
    priceByTier: TierPrice[];
    network: Share<Network>[];
    topUp: Share<boolean>[];
    validity: Share<number>[];
    coverage: { destinations: number; countries: number; regions: number };
    bestDeals: BestDeal[];
    distribution: HistogramBin[];
  };
  market: MarketStats;
  opportunities: Opportunities;
}

export const eurPerGb = (p: Product): number | null => (p.dataGb ? p.price / p.dataGb : null);

function shares<K>(products: Product[], keys: readonly K[], pick: (p: Product) => K): Share<K>[] {
  const total = products.length;
  return keys.map((key) => {
    const count = products.filter((p) => pick(p) === key).length;
    return { key, count, share: total ? count / total : 0 };
  });
}

/** Every figure shown on the dashboard, computed from any product subset. */
export function computeStats(products: Product[], bestDealsLimit = 8): Stats {
  const total = products.length;
  const prices = products.map((p) => p.price);
  const finite = products.filter((p) => p.dataGb !== null);

  let cheapest: Product | null = null;
  let priciest: Product | null = null;
  for (const p of products) {
    if (!cheapest || p.price < cheapest.price) cheapest = p;
    if (!priciest || p.price > priciest.price) priciest = p;
  }

  const over100 = products.filter((p) => p.price > PRICE_THRESHOLD).length;
  const byProviderMap = groupBy(products, (p) => p.provider);

  const byProvider = [...byProviderMap]
    .map(([provider, list]) => ({ provider, count: list.length, share: list.length / total }))
    .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider, "fr"));

  const valueByProvider = [...byProviderMap]
    .map(([provider, list]) => {
      const perGb = list.map(eurPerGb).filter((v): v is number => v !== null);
      return { provider, medianEurPerGb: median(perGb), offers: perGb.length };
    })
    .filter((v): v is ProviderValue => v.medianEurPerGb !== null)
    .sort((a, b) => a.medianEurPerGb - b.medianEurPerGb);

  const priceByTier = DATA_TIERS.map((dataGb) => {
    const list = products.filter((p) => p.dataGb === dataGb).map((p) => p.price);
    return { dataGb, median: median(list), count: list.length };
  }).filter((t): t is TierPrice => t.median !== null);

  const byDestination = groupBy(products, (p) => p.countryCode);
  const bestDeals = [...byDestination]
    .map(([countryCode, list]) => {
      let best: Product | null = null;
      for (const p of list) {
        const v = eurPerGb(p);
        if (v === null) continue;
        const bv = best ? (eurPerGb(best) as number) : Number.POSITIVE_INFINITY;
        if (v < bv || (v === bv && best && p.price < best.price)) best = p;
      }
      return best
        ? {
            countryCode,
            countryName: list[0].countryName,
            offers: list.length,
            best,
            eurPerGb: eurPerGb(best) as number,
          }
        : null;
    })
    .filter((d): d is BestDeal => d !== null)
    .sort((a, b) => b.offers - a.offers || a.countryName.localeCompare(b.countryName, "fr"))
    .slice(0, bestDealsLimit);

  const codes = [...byDestination.keys()];
  const regions = codes.filter((c) => REGION_CODES.has(c)).length;

  return {
    total,
    over100: { count: over100, share: total ? over100 / total : 0 },
    price: {
      min: cheapest?.price ?? null,
      max: priciest?.price ?? null,
      avg: mean(prices),
      median: median(prices),
      cheapest,
      priciest,
    },
    data: {
      avgGb: mean(finite.map((p) => p.dataGb as number)),
      finiteCount: finite.length,
      unlimited: total - finite.length,
    },
    byProvider,
    bonus: {
      valueByProvider,
      priceByTier,
      network: shares(products, ["4G", "5G"] as const, (p) => p.network),
      topUp: shares(products, [true, false] as const, (p) => p.topUp),
      validity: shares(products, VALIDITIES, (p) => p.validityDays),
      coverage: { destinations: codes.length, countries: codes.length - regions, regions },
      bestDeals,
      distribution: priceHistogram(products),
    },
    market: computeMarket(products),
    opportunities: computeOpportunities(products),
  };
}
