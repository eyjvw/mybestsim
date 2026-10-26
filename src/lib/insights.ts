import { formatEur, formatEurPerGb, formatInt, formatPct, formatTier } from "./format";
import type { Stats } from "./stats";

export interface Insight {
  id: string;
  title: string;
  detail: string;
}

/** Price differences below this ratio are reported as "no premium". */
const SAME_PRICE_TOLERANCE = 0.02;

const planLabel = (p: { countryName: string; dataGb: number | null; validityDays: number }) =>
  `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;

/**
 * Plain-language findings derived from the current selection. Each one is only stated when
 * the data supports it, so the list follows the filters instead of repeating fixed copy.
 */
export function buildInsights(s: Stats, limit = 4): Insight[] {
  const out: Insight[] = [];
  const m = s.market;

  const gap = m.biggestGaps[0];
  if (gap && gap.max > gap.min) {
    out.push({
      id: "gap",
      title: `Jusqu'à ${formatEur(gap.max - gap.min)} d'écart pour le même forfait`,
      detail: `${planLabel(gap)} : ${formatEur(gap.min)} chez ${gap.cheapest.provider}, ${formatEur(gap.max)} chez ${gap.priciest.provider}. Comparer paie.`,
    });
  }

  if (s.total > 1 && m.efficient.count < s.total) {
    out.push({
      id: "dominated",
      title: `${formatPct(1 - m.efficient.share)} des offres sont battues par une autre`,
      detail: `Pour ${formatInt(s.total - m.efficient.count)} offres, la même destination propose moins cher avec au moins autant de data, de durée, de réseau et de recharge. Seules ${formatInt(m.efficient.count)} valent d'être mises en avant.`,
    });
  }

  const tiers = new Map(s.bonus.priceByTier.map((t) => [t.dataGb, t]));
  const unlimited = tiers.get(null);
  const biggest = [...tiers.values()]
    .filter((t) => t.dataGb !== null)
    .sort((a, b) => (b.dataGb as number) - (a.dataGb as number))[0];
  if (unlimited && biggest && unlimited.median < biggest.median) {
    out.push({
      id: "unlimited",
      title: `L'illimité coûte moins cher que le ${formatTier(biggest.dataGb)}`,
      detail: `Prix médian ${formatEur(unlimited.median)} pour l'illimité contre ${formatEur(biggest.median)} pour ${formatTier(biggest.dataGb)}. Si vous visez ${formatTier(biggest.dataGb)}, regardez d'abord l'illimité.`,
    });
  }

  const ratio = m.networkPremium.medianRatio;
  if (ratio !== null) {
    const same = Math.abs(ratio - 1) < SAME_PRICE_TOLERANCE;
    out.push({
      id: "5g",
      title: same
        ? "La 5G ne coûte pas plus cher que la 4G"
        : `La 5G coûte ${formatPct(Math.abs(ratio - 1))} ${ratio > 1 ? "de plus" : "de moins"}`,
      detail: `Sur ${formatInt(m.networkPremium.plans)} forfaits vendus dans les deux réseaux, le prix médian 5G vaut ${formatPct(ratio)} du prix 4G.`,
    });
  }

  const leader = m.wins[0];
  if (leader && m.comparable > 0) {
    out.push({
      id: "wins",
      title: `${leader.provider} est le moins cher sur ${formatInt(leader.wins)} forfaits`,
      detail: `Soit ${formatPct(leader.share)} des ${formatInt(m.comparable)} forfaits proposés par plusieurs fournisseurs.${leader.share < 1 ? " Aucun fournisseur n'est le moins cher partout." : ""}`,
    });
  }

  const small = tiers.get(1);
  const large = tiers.get(50);
  if (small && large && small.count && large.count) {
    out.push({
      id: "per-gb",
      title: `Le Go coûte ${Math.round(small.median / (large.median / 50))} fois moins cher en 50 Go qu'en 1 Go`,
      detail: `${formatEurPerGb(small.median)} en 1 Go contre ${formatEurPerGb(large.median / 50)} en 50 Go (prix médians).`,
    });
  }

  return out.slice(0, limit);
}
