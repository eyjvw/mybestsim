import { median } from "./math";
import { regionsCovering } from "./regions";
import { DATA_TIERS } from "./stats";
import type { Product } from "./types";

export type DataNeed = number | "unlimited";

export interface FinderQuery {
  destination: string;
  /** Minimum data volume in GB, or "unlimited" to accept unlimited offers only. */
  data: DataNeed;
  /** Trip length in days: the offer must stay valid at least that long. */
  days: number;
  /** Also accept regional plans (Europe, Asia, World…) that cover the destination. */
  regional: boolean;
}

export interface FinderMatch {
  product: Product;
  /** Region code when the offer is a regional plan covering the destination. */
  viaRegion: string | null;
  /** How much cheaper than the median eligible offer. */
  saving: number;
}

export interface FinderResult {
  eligible: number;
  medianPrice: number | null;
  /** Cheapest eligible offer for the destination itself only, to show what regional plans save. */
  cheapestLocal: Product | null;
  matches: FinderMatch[];
}

export function isEligible(p: Product, q: FinderQuery, regions: readonly string[]): boolean {
  if (p.countryCode !== q.destination && !regions.includes(p.countryCode)) return false;
  if (p.validityDays < q.days) return false;
  if (q.data === "unlimited") return p.dataGb === null;
  return p.dataGb === null || p.dataGb >= q.data;
}

/** Cheapest offers that cover the whole trip, cheapest first (ties: more data, then SKU). */
export function findPlans(products: Product[], q: FinderQuery, limit = 5): FinderResult {
  const regions = q.regional ? regionsCovering(q.destination) : [];
  const eligible = products
    .filter((p) => isEligible(p, q, regions))
    .sort(
      (a, b) =>
        a.price - b.price ||
        (b.dataGb ?? Number.POSITIVE_INFINITY) - (a.dataGb ?? Number.POSITIVE_INFINITY) ||
        a.sku.localeCompare(b.sku),
    );
  const medianPrice = median(eligible.map((p) => p.price));
  return {
    eligible: eligible.length,
    medianPrice,
    cheapestLocal: eligible.find((p) => p.countryCode === q.destination) ?? null,
    matches: eligible.slice(0, limit).map((product) => ({
      product,
      viaRegion: product.countryCode === q.destination ? null : product.countryCode,
      saving: (medianPrice as number) - product.price,
    })),
  };
}

export interface UsageProfile {
  id: "light" | "medium" | "heavy";
  label: string;
  hint: string;
  gbPerDay: number;
}

/** Rough daily needs, stated as assumptions in the UI. */
export const USAGE_PROFILES: readonly UsageProfile[] = [
  { id: "light", label: "Léger", hint: "messagerie, cartes, e-mails", gbPerDay: 0.3 },
  {
    id: "medium",
    label: "Modéré",
    hint: "réseaux sociaux, photos, un peu de streaming",
    gbPerDay: 1,
  },
  { id: "heavy", label: "Intensif", hint: "vidéo, visio, partage de connexion", gbPerDay: 2.5 },
];

/** Smallest catalog data tier covering `days` of use at `gbPerDay`, else unlimited. */
export function estimateData(days: number, gbPerDay: number): DataNeed {
  const need = days * gbPerDay;
  const tier = DATA_TIERS.find((t): t is number => t !== null && t >= need);
  return tier ?? "unlimited";
}
