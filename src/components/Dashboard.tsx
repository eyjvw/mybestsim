import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "../lib/filters";
import {
  formatEur,
  formatEurPerGb,
  formatGb,
  formatInt,
  formatPct,
  formatTier,
} from "../lib/format";
import { computeStats, type Stats } from "../lib/stats";
import type { Product } from "../lib/types";
import { BarList } from "./charts/BarList";
import { ColumnChart } from "./charts/ColumnChart";
import { SplitBar } from "./charts/SplitBar";
import { FilterBar, type FilterOptions } from "./FilterBar";
import { KpiCard, KpiValue } from "./KpiCard";
import { ProductTable } from "./ProductTable";
import { Panel, Section } from "./Section";

interface Props {
  /** Stats of the full catalog, computed at build time (first paint, no JS needed). */
  initialStats: Stats;
  /** First page of the product table, so it is server-rendered too. */
  initialRows: Product[];
  options: FilterOptions;
  catalogUrl: string;
}

export default function Dashboard({ initialStats, initialRows, options, catalogUrl }: Props) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const deferred = useDeferredValue(filters);

  useEffect(() => {
    fetch(catalogUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { products: Product[] }) => setProducts(data.products))
      .catch(() => setError(true));
  }, [catalogUrl]);

  const filtered = useMemo(
    () => (products ? applyFilters(products, deferred) : null),
    [products, deferred],
  );
  const s = useMemo(
    () => (filtered ? computeStats(filtered) : initialStats),
    [filtered, initialStats],
  );
  const stale = filters !== deferred;

  return (
    <div className="space-y-10">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        options={options}
        shown={s.total}
        total={initialStats.total}
        ready={products !== null}
      />
      {error && (
        <p role="alert" className="rounded-lg border border-s2/40 bg-s2/10 px-3 py-2 text-sm">
          Le catalogue n'a pas pu être chargé : les chiffres affichés concernent le catalogue
          complet et les filtres sont désactivés.
        </p>
      )}

      <div className={`space-y-10 transition-opacity ${stale ? "opacity-60" : ""}`}>
        <Section
          id="kpis"
          title="Indicateurs clés"
          description="Les cinq premiers indicateurs demandés. Ils se recalculent selon les filtres."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              index={1}
              label="Cartes eSIM"
              footnote={`${formatInt(s.byProvider.length)} fournisseurs · ${formatInt(s.bonus.coverage.destinations)} destinations`}
            >
              <KpiValue kpi="total" value={s.total}>
                {formatInt(s.total)}
              </KpiValue>
            </KpiCard>
            <KpiCard
              index={2}
              label="Produits à plus de 100 €"
              footnote={`${formatPct(s.over100.share)} du catalogue`}
            >
              <KpiValue kpi="over100" value={s.over100.count}>
                {formatInt(s.over100.count)}
              </KpiValue>
            </KpiCard>
            <KpiCard
              index={3}
              label="Fourchette de prix"
              footnote={
                s.price.cheapest && s.price.priciest
                  ? `De ${s.price.cheapest.name} (${s.price.cheapest.provider}) à ${s.price.priciest.name} (${s.price.priciest.provider})`
                  : undefined
              }
            >
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 text-2xl sm:text-[1.6rem]">
                <dt className="text-xs font-normal text-ink-3">min</dt>
                <dd className="whitespace-nowrap">
                  <KpiValue kpi="price-min" value={s.price.min}>
                    {formatEur(s.price.min)}
                  </KpiValue>
                </dd>
                <dt className="text-xs font-normal text-ink-3">max</dt>
                <dd className="whitespace-nowrap">
                  <KpiValue kpi="price-max" value={s.price.max}>
                    {formatEur(s.price.max)}
                  </KpiValue>
                </dd>
              </dl>
            </KpiCard>
            <KpiCard
              index={4}
              label="Data moyenne par carte"
              footnote={
                s.data.unlimited > 0
                  ? `Hors ${formatInt(s.data.unlimited)} offres illimitées (${formatPct(s.total ? s.data.unlimited / s.total : 0)}), sans volume chiffré`
                  : "Toutes les offres ont un volume chiffré"
              }
            >
              <KpiValue kpi="avg-data" value={s.data.avgGb}>
                {formatGb(s.data.avgGb)}
              </KpiValue>
            </KpiCard>
            <KpiCard
              index={5}
              label="Prix moyen"
              footnote={`Médiane : ${formatEur(s.price.median)}`}
            >
              <KpiValue kpi="avg-price" value={s.price.avg}>
                {formatEur(s.price.avg)}
              </KpiValue>
            </KpiCard>
          </div>
        </Section>

        <Section
          id="providers"
          index={6}
          title="Répartition par fournisseur"
          description="Nombre de cartes proposées par chaque fournisseur. Survolez une barre pour voir sa part du catalogue."
        >
          <Panel
            title={`${formatInt(s.byProvider.length)} fournisseurs, triés par nombre de cartes`}
          >
            <BarList
              caption="Nombre de cartes par fournisseur"
              items={s.byProvider.map((p) => ({
                label: p.provider,
                value: p.count,
                display: formatInt(p.count),
                detail: `${formatPct(p.share)} des cartes`,
              }))}
            />
          </Panel>
        </Section>

        <Section
          id="bonus"
          index={7}
          title="Pour aller plus loin"
          description="Les statistiques qu'un comparateur d'eSIM regarde en premier : rapport qualité/prix, prix selon le volume, profil des offres et meilleures affaires."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Rapport qualité/prix : prix médian au Go"
              note="Médiane du prix au Go sur les offres à volume chiffré (les illimitées n'ont pas de prix au Go). Plus la barre est courte, moins c'est cher."
            >
              <BarList
                caption="Prix médian au Go par fournisseur"
                items={s.bonus.valueByProvider.map((v) => ({
                  label: v.provider,
                  value: v.medianEurPerGb,
                  display: formatEurPerGb(v.medianEurPerGb),
                  detail: `sur ${formatInt(v.offers)} offres`,
                }))}
              />
            </Panel>
            <div className="grid gap-4">
              <Panel
                title="Prix médian selon le volume de data"
                note="Le prix ne croît pas proportionnellement au volume : les gros forfaits reviennent bien moins cher au Go."
              >
                <ColumnChart
                  caption="Prix médian par palier de data"
                  columns={s.bonus.priceByTier.map((t) => ({
                    label: formatTier(t.dataGb),
                    value: t.median,
                    display: formatEur(t.median),
                    detail: `${formatInt(t.count)} offres`,
                  }))}
                />
              </Panel>
              <Panel title="Profil des offres">
                <div className="space-y-4">
                  <SplitBar
                    title="Réseau"
                    segments={s.bonus.network.map((n) => ({
                      label: n.key,
                      count: n.count,
                      share: n.share,
                    }))}
                  />
                  <SplitBar
                    title="Recharge possible (top-up)"
                    segments={s.bonus.topUp.map((n) => ({
                      label: n.key ? "Oui" : "Non",
                      count: n.count,
                      share: n.share,
                    }))}
                  />
                  <SplitBar
                    title="Durée de validité"
                    segments={s.bonus.validity.map((n) => ({
                      label: `${n.key} jours`,
                      count: n.count,
                      share: n.share,
                    }))}
                  />
                </div>
              </Panel>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <Panel
              title="Couverture"
              note="EU, AS, NA et WW ne sont pas des pays : ce sont des forfaits multi-pays (Europe, Asie, Amérique du Nord, Monde)."
            >
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Destinations", s.bonus.coverage.destinations],
                  ["Pays", s.bonus.coverage.countries],
                  ["Régions", s.bonus.coverage.regions],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-2 px-2 py-3">
                    <dd className="text-2xl font-semibold tabular-nums">
                      {formatInt(value as number)}
                    </dd>
                    <dt className="text-xs text-ink-3">{label}</dt>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel
              title="Meilleure offre au Go sur les destinations les plus proposées"
              note="Pour chaque destination, l'offre au plus bas prix par Go (à prix égal, la moins chère l'emporte)."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-3">
                      <th scope="col" className="py-1.5 pr-3 font-medium">
                        Destination
                      </th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                        Offres
                      </th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">
                        Meilleure offre
                      </th>
                      <th scope="col" className="py-1.5 text-right font-medium">
                        €/Go
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.bonus.bestDeals.map((d) => (
                      <tr key={d.countryCode} className="border-b border-line/60 last:border-0">
                        <td className="py-1.5 pr-3">{d.countryName}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-ink-2">
                          {formatInt(d.offers)}
                        </td>
                        <td className="py-1.5 pr-3 text-ink-2">
                          {d.best.provider} · {formatTier(d.best.dataGb)} · {d.best.validityDays} j
                          · {formatEur(d.best.price)}
                        </td>
                        <td className="py-1.5 text-right font-medium tabular-nums">
                          {formatEurPerGb(d.eurPerGb)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </Section>

        <Section
          id="products"
          title="Toutes les offres"
          description="Le détail des offres filtrées. Cliquez sur un en-tête pour trier ; la recherche ignore les accents."
        >
          <ProductTable
            products={filtered ?? initialRows}
            pendingTotal={filtered ? undefined : initialStats.total}
          />
        </Section>
      </div>
    </div>
  );
}
