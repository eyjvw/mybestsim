import type { CatalogDiff } from "./diff";
import { groupBy } from "./math";
import type { Product } from "./types";

/**
 * Import guard: a supplier file that reprices or drops a large part of a provider's range
 * at once is far more often a broken export than a real market move. Such an import is
 * held back for a human, instead of being published.
 */
export interface GuardConfig {
  /** A price change at least this large (relative) counts as a big move. */
  bigMove: number;
  /** Maximum share of a provider's current offers allowed to move that much. */
  maxBigMoveShare: number;
  /** Maximum share of a provider's current offers allowed to disappear. */
  maxRemovedShare: number;
  /** Providers with fewer current offers are not checked (shares are meaningless). */
  minBase: number;
}

export const DEFAULT_GUARD: GuardConfig = {
  bigMove: 0.3,
  maxBigMoveShare: 0.2,
  maxRemovedShare: 0.5,
  minBase: 10,
};

export interface GuardViolation {
  provider: string;
  kind: "price-moves" | "removed";
  count: number;
  base: number;
  share: number;
}

export interface GuardResult {
  ok: boolean;
  violations: GuardViolation[];
}

export function checkGuard(
  diff: CatalogDiff,
  base: Product[],
  config: GuardConfig = DEFAULT_GUARD,
): GuardResult {
  const sizes = new Map([...groupBy(base, (p) => p.provider)].map(([k, v]) => [k, v.length]));
  const moves = groupBy(
    diff.repriced.filter((c) => Math.abs(c.pct) >= config.bigMove),
    (c) => c.before.provider,
  );
  const removed = groupBy(diff.removed, (p) => p.provider);
  const violations: GuardViolation[] = [];
  for (const [provider, size] of sizes) {
    if (size < config.minBase) continue;
    const m = moves.get(provider)?.length ?? 0;
    if (m / size > config.maxBigMoveShare) {
      violations.push({ provider, kind: "price-moves", count: m, base: size, share: m / size });
    }
    const r = removed.get(provider)?.length ?? 0;
    if (r / size > config.maxRemovedShare) {
      violations.push({ provider, kind: "removed", count: r, base: size, share: r / size });
    }
  }
  violations.sort(
    (a, b) => a.provider.localeCompare(b.provider, "fr") || a.kind.localeCompare(b.kind),
  );
  return { ok: violations.length === 0, violations };
}
