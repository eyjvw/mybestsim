import { groupPlans } from "./compare";
import { groupBy, median } from "./math";
import { mybestsimUrl } from "./mybestsim";
import type { Product } from "./types";

/** Destinations with fewer comparable plans than this are left out: one odd plan would rank them. */
export const MIN_COMPARABLE_PLANS = 5;

export interface DestinationGap {
  countryCode: string;
  countryName: string;
  /** Plans of this destination sold by at least two providers. */
  comparable: number;
  providers: number;
  /** Median, over those plans, of (dearest − cheapest): how much the price of one plan varies. */
  medianGap: number;
  /** Same, as a share of the dearest price. */
  medianGapPct: number;
  /** The destination's page on mybestsim.com, when known. */
  url: string | null;
}

export interface Opportunities {
  gaps: DestinationGap[];
}

/**
 * Where prices vary most for the same plan, so where a comparator helps the traveller most: the
 * pages worth pushing. Pure: it follows whatever selection it is given.
 */
export function computeOpportunities(products: Product[], limit = 8): Opportunities {
  const byCountry = groupBy(products, (p) => p.countryCode);
  const comparable = groupPlans(products).filter((g) => g.providers >= 2);
  const gaps: DestinationGap[] = [];
  for (const [code, plans] of groupBy(comparable, (g) => g.countryCode)) {
    if (plans.length < MIN_COMPARABLE_PLANS) continue;
    gaps.push({
      countryCode: code,
      countryName: plans[0].countryName,
      comparable: plans.length,
      providers: new Set((byCountry.get(code) ?? []).map((p) => p.provider)).size,
      medianGap: median(plans.map((g) => g.max - g.min)) as number,
      medianGapPct: median(plans.map((g) => (g.max - g.min) / g.max)) as number,
      url: mybestsimUrl(code),
    });
  }
  gaps.sort((a, b) => b.medianGap - a.medianGap || a.countryCode.localeCompare(b.countryCode));
  return { gaps: gaps.slice(0, limit) };
}
