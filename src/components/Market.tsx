import type { MarketStats } from "../lib/compare";
import { formatEur, formatInt, formatPct, formatTier } from "../lib/format";
import { BarList } from "./charts/BarList";
import { Panel } from "./Section";

interface Props {
  market: MarketStats;
  total: number;
}

function Figure({
  kpi,
  value,
  label,
  children,
}: {
  kpi: string;
  value: number | null;
  label: string;
  children: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-2.5">
      <dd className="text-xl font-semibold" data-kpi={kpi} data-value={value ?? ""}>
        {children}
      </dd>
      <dt className="mt-0.5 text-xs leading-snug text-ink-3">{label}</dt>
    </div>
  );
}

/** What a comparator is for: the same plan, sold at very different prices. */
export function Market({ market: m, total }: Props) {
  const top = m.wins.slice(0, 8);
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <div className="grid min-w-0 content-start gap-4">
        <Panel
          title="Le même forfait, des prix différents"
          note="Un forfait = une destination, un volume de data et une durée. Il est comparable quand au moins deux fournisseurs le vendent."
        >
          <dl className="grid grid-cols-2 gap-2">
            <Figure
              kpi="comparable-plans"
              value={m.comparable}
              label={`forfaits comparables sur ${formatInt(m.plans)}`}
            >
              {formatInt(m.comparable)}
            </Figure>
            <Figure
              kpi="median-saving"
              value={m.medianSaving}
              label="économie médiane en prenant le moins cher plutôt que le prix médian"
            >
              {formatEur(m.medianSaving)}
            </Figure>
            <Figure
              kpi="median-saving-pct"
              value={m.medianSavingPct}
              label="soit, en part du prix médian"
            >
              {formatPct(m.medianSavingPct)}
            </Figure>
            <Figure
              kpi="efficient"
              value={m.efficient.count}
              label={`offres imbattables sur ${formatInt(total)} (aucune autre n'est moins chère et au moins aussi complète)`}
            >
              {formatInt(m.efficient.count)}
            </Figure>
          </dl>
        </Panel>
        <Panel
          title="Qui est le moins cher, et combien de fois"
          note="Nombre de forfaits comparables où le fournisseur propose le prix le plus bas (ex æquo comptés pour chacun). 8 premiers."
        >
          <BarList
            caption="Forfaits où le fournisseur est le moins cher"
            items={top.map((w) => ({
              label: w.provider,
              value: w.wins,
              display: formatInt(w.wins),
              detail: formatPct(w.share),
            }))}
          />
        </Panel>
      </div>
      <Panel
        title="Les plus gros écarts de prix pour un même forfait"
        note="Écart entre l'offre la moins chère et la plus chère du même forfait. C'est l'économie qu'un voyageur fait en comparant."
      >
        {m.biggestGaps.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">Aucun forfait comparable dans la sélection.</p>
        ) : (
          <ol className="divide-y divide-line/70" data-gaps>
            {m.biggestGaps.map((g) => (
              <li
                key={g.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5"
              >
                <p className="min-w-0 text-sm font-medium">
                  {g.countryName} · {formatTier(g.dataGb)} · {g.validityDays} j
                </p>
                <p className="text-right text-sm font-semibold whitespace-nowrap tabular-nums">
                  {formatEur(g.max - g.min)}
                </p>
                <p className="min-w-0 text-xs text-ink-2 max-sm:col-span-2">
                  {formatEur(g.min)} chez {g.cheapest.provider} · {formatEur(g.max)} chez{" "}
                  {g.priciest.provider}
                </p>
                <p className="text-xs whitespace-nowrap text-ink-3 tabular-nums max-sm:col-span-2 sm:text-right">
                  {formatInt(g.offers)} offres · ×{(g.max / g.min).toFixed(2).replace(".", ",")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
