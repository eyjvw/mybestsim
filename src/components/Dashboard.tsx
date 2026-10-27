import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { type AuditSummary, auditCatalog, summarizeAudit } from "../lib/audit";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  type FilterDomain,
  type Filters,
  filterOptions,
  filtersFromSearch,
  filtersToSearch,
} from "../lib/filters";
import {
  formatEur,
  formatEurPerGb,
  formatGb,
  formatInt,
  formatPct,
  formatTier,
} from "../lib/format";
import { buildInsights } from "../lib/insights";
import { loadLive } from "../lib/live-client";
import { isSandbox, LIVE_DATA, type LiveCatalog, SANDBOX_DATA, withSandbox } from "../lib/runtime";
import { computeStats, DATA_TIERS, type Stats, VALIDITIES } from "../lib/stats";
import type { Product, QualityReport } from "../lib/types";
import { Changes } from "./Changes";
import { BarList } from "./charts/BarList";
import { ColumnChart } from "./charts/ColumnChart";
import { Histogram } from "./charts/Histogram";
import { SplitBar } from "./charts/SplitBar";
import { Explore } from "./Explore";
import { FilterBar, type FilterOptions } from "./FilterBar";
import { Finder } from "./Finder";
import { Insights } from "./Insights";
import { KpiCard, KpiValue } from "./KpiCard";
import { Market } from "./Market";
import { ProductTable } from "./ProductTable";
import { Quality } from "./Quality";
import { Panel, Section } from "./Section";

const offerLabel = (p: Product) =>
  `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j (${p.provider})`;

interface Props {
  /** Stats of the full catalog, computed at build time (first paint, no JS needed). */
  initialStats: Stats;
  /** First page of the product table, so it is server-rendered too. */
  initialRows: Product[];
  options: FilterOptions;
  /** Build-time quality report and audit, shown until the live data has loaded. */
  initialQuality: QualityReport;
  initialAudit: AuditSummary;
  builtAt: string;
  /** Which page this island renders: the home overview or one of the sub-pages. */
  view: "overview" | "analysis" | "offers" | "quality";
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

/** The current page without `?bac=1`: back to production's data. Client-side only. */
const leaveSandbox = () => {
  const { pathname, search, hash } = window.location;
  return `${pathname}${withSandbox(search, false)}${hash}`;
};

/** Where the figures come from: the last import (live or sandbox) or the build snapshot. */
function DataSource({
  live,
  builtAt,
  sandbox,
}: {
  live: LiveCatalog | null;
  builtAt: string;
  sandbox: boolean;
}) {
  if (!live) return null;
  const origin = (v: NonNullable<LiveCatalog["version"]>) =>
    v.source === "seed" ? "jeu initial" : v.source === "inbox" ? "dépôt fournisseur" : "API";
  return (
    <span
      className="mt-1.5 flex items-start gap-2 text-xs text-ink-3"
      data-source={live.source}
      data-sandbox={sandbox ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`mt-1 size-2 shrink-0 rounded-full ${live.source !== "live" ? "bg-rule" : sandbox ? "bg-warn" : "bg-good"}`}
      />
      {sandbox ? (
        <span>
          {live.source === "live" && live.version
            ? `Bac à sable : import du ${when(live.version.importedAt)} (${origin(live.version)}). Données de démonstration, remises à zéro chaque nuit.`
            : `Bac à sable indisponible : instantané du build du ${when(builtAt)}.`}{" "}
          <a
            className="font-semibold text-accent underline-offset-2 hover:underline"
            href={leaveSandbox()}
          >
            Revenir aux données en ligne
          </a>
        </span>
      ) : live.source === "live" && live.version ? (
        `Données en direct : import du ${when(live.version.importedAt)} (${origin(live.version)}), sans rebuild du site.`
      ) : (
        `Instantané du build du ${when(builtAt)} (service d'ingestion non joignable).`
      )}
    </span>
  );
}

export default function Dashboard({
  initialStats,
  initialRows,
  options: buildOptions,
  initialQuality,
  initialAudit,
  builtAt,
  view,
}: Props) {
  const [live, setLive] = useState<LiveCatalog | null>(null);
  const products = live?.products ?? null;
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const deferred = useDeferredValue(filters);
  const urlRead = useRef(false);
  // ?bac=1: the public sandbox's data instead of production's, kept in every link.
  const [sandbox, setSandbox] = useState(false);
  const sandboxRef = useRef(false);

  // Filter choices follow the catalog shown: a new provider appears without a rebuild.
  const options = useMemo(
    () => live?.summary?.options ?? (products ? filterOptions(products) : buildOptions),
    [live, products, buildOptions],
  );
  const domain = useMemo<FilterDomain>(
    () => ({
      providers: options.providers,
      destinations: options.destinations.map((d) => d.code),
      validities: VALIDITIES,
      dataTiers: DATA_TIERS,
    }),
    [options],
  );

  useEffect(() => {
    const sb = isSandbox(window.location.search);
    sandboxRef.current = sb;
    setSandbox(sb);
    // Fetched and summarised in a worker; the re-render with the new figures can be interrupted.
    loadLive(sb ? SANDBOX_DATA : LIVE_DATA)
      .then((c) => startTransition(() => setLive(c)))
      .catch(() => setError(true));
  }, []);

  // The URL carries the filters: a shared link reopens the same view. Read once the live
  // catalog is known, so a provider that only exists in live data is accepted too.
  useEffect(() => {
    if (urlRead.current || !products) return;
    setFilters(filtersFromSearch(window.location.search, domain));
    urlRead.current = true;
  }, [domain, products]);
  useEffect(() => {
    if (!urlRead.current) return;
    const { pathname, hash } = window.location;
    const search = withSandbox(filtersToSearch(filters), sandboxRef.current);
    window.history.replaceState(null, "", `${pathname}${search}${hash}`);
    // Links between pages carry the filters, so the selection follows the visitor.
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-keep-filters]")) {
      const url = new URL(a.href, window.location.href);
      url.search = search;
      a.href = `${url.pathname}${url.search}${url.hash}`;
    }
    // Pages without filters that can show the sandbox keep only its flag.
    for (const a of document.querySelectorAll<HTMLAnchorElement>(
      "a[data-keep-sandbox]:not([data-keep-filters])",
    )) {
      const url = new URL(a.href, window.location.href);
      a.href = `${url.pathname}${withSandbox(url.search, sandboxRef.current)}${url.hash}`;
    }
  }, [filters]);

  const filtered = useMemo(
    () => (products ? applyFilters(products, deferred) : null),
    [products, deferred],
  );
  // No filter: the worker's stats of the whole catalog, instead of computing them again here.
  const unfiltered = activeFilterCount(deferred) === 0;
  const s = useMemo(
    () =>
      !filtered
        ? initialStats
        : unfiltered && live?.summary
          ? live.summary.stats
          : computeStats(filtered),
    [filtered, unfiltered, live, initialStats],
  );
  const insights = useMemo(() => buildInsights(s), [s]);
  // The business checks always look at the whole catalog, not at the filtered view.
  const audit = useMemo(
    () =>
      live?.summary?.audit ?? (products ? summarizeAudit(auditCatalog(products)) : initialAudit),
    [live, products, initialAudit],
  );
  const quality = live?.version?.quality ?? initialQuality;
  const stale = filters !== deferred;

  return (
    <div className="space-y-10">
      {sandbox && (
        <div
          role="status"
          data-sandbox-banner
          className="rounded-2xl border border-warn bg-warn/15 px-4 py-3 text-sm text-ink"
        >
          <strong>Bac à sable</strong> : vous voyez les données publiées sans jeton depuis{" "}
          <a
            className="font-semibold text-accent underline-offset-2 hover:underline"
            href="/import"
          >
            la page d'import
          </a>
          , remises à zéro chaque nuit. Le vrai catalogue n'est pas touché.{" "}
          <a
            className="font-semibold text-accent underline-offset-2 hover:underline"
            href={leaveSandbox()}
          >
            Revenir aux données en ligne
          </a>
        </div>
      )}
      {view !== "quality" && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          options={options}
          shown={s.total}
          total={products?.length ?? initialStats.total}
          ready={products !== null}
        />
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-cta/30 bg-cta/5 px-4 py-2.5 text-sm">
          Le catalogue n'a pas pu être chargé : les chiffres affichés concernent le catalogue
          complet et les filtres sont désactivés.
        </p>
      )}

      <div className={`space-y-12 transition-opacity ${stale ? "opacity-60" : ""}`}>
        {view === "overview" && (
          <>
            <Section
              id="kpis"
              title="Indicateurs clés"
              description={
                <>
                  Les cinq premiers indicateurs demandés. Ils se recalculent selon les filtres.
                  <DataSource live={live} builtAt={builtAt} sandbox={sandbox} />
                </>
              }
            >
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
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
                  label="Produits à plus de 100 €"
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
                      ? `${offerLabel(s.price.cheapest)} → ${offerLabel(s.price.priciest)}`
                      : undefined
                  }
                >
                  <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 text-[1.35rem] sm:text-[1.6rem]">
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
              id="insights"
              title="À retenir"
              description="Constats calculés sur la sélection en cours : ils changent avec les filtres."
            >
              <Insights insights={insights} />
            </Section>

            {live?.changes && (
              <Section
                id="changes"
                title="Depuis le dernier import"
                description="Ce que le dernier fichier publié a changé dans le catalogue, calculé par le service d'ingestion à la publication."
              >
                <Changes changes={live.changes} />
              </Section>
            )}

            <Section
              id="providers"
              index={6}
              title="Répartition par fournisseur"
              description="Nombre de cartes proposées par chaque fournisseur, et sa part du catalogue."
            >
              <Panel
                title={`${formatInt(s.byProvider.length)} fournisseurs, triés par nombre de cartes`}
              >
                <BarList
                  wide
                  caption="Nombre de cartes par fournisseur"
                  items={s.byProvider.map((p) => ({
                    label: p.provider,
                    value: p.count,
                    display: formatInt(p.count),
                    detail: formatPct(p.share),
                  }))}
                />
              </Panel>
            </Section>

            <Explore stats={s} audit={audit} />
          </>
        )}

        {view === "analysis" && (
          <>
            <Section
              id="bonus"
              index={7}
              title="Pour aller plus loin"
              description="Les statistiques qu'un comparateur d'eSIM regarde en premier : prix au Go, prix selon le volume, distribution des prix et profil des offres."
            >
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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
                      detail: `${formatInt(v.offers)} off.`,
                    }))}
                  />
                </Panel>
                <div className="grid min-w-0 gap-4">
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
                        detail: `${formatInt(t.count)} off.`,
                      }))}
                    />
                  </Panel>
                  <Panel
                    title="Distribution des prix"
                    note="La moyenne est tirée vers le haut par quelques forfaits illimités chers : la médiane décrit mieux le prix courant."
                  >
                    <Histogram
                      caption="Nombre d'offres par tranche de prix de 10 €"
                      bins={s.bonus.distribution}
                      markers={[
                        ...(s.price.median !== null
                          ? [{ label: "Médiane", short: "méd.", value: s.price.median }]
                          : []),
                        ...(s.price.avg !== null
                          ? [{ label: "Moyenne", short: "moy.", value: s.price.avg }]
                          : []),
                      ]}
                    />
                  </Panel>
                </div>
                <div className="grid min-w-0 content-start gap-4">
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
                        <div key={label} className="rounded-2xl bg-surface-2 px-2 py-3">
                          <dd className="text-2xl font-semibold">{formatInt(value as number)}</dd>
                          <dt className="text-xs text-ink-3">{label}</dt>
                        </div>
                      ))}
                    </dl>
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
                <div className="min-w-0 2xl:col-span-3">
                  <Panel
                    title="Meilleure offre au Go sur les destinations les plus proposées"
                    note="Pour chaque destination, l'offre au plus bas prix par Go (à prix égal, la moins chère l'emporte)."
                  >
                    <ol className="grid gap-x-10 md:grid-cols-2 2xl:grid-cols-4">
                      {s.bonus.bestDeals.map((d) => (
                        <li
                          key={d.countryCode}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-line/70 py-2.5"
                        >
                          <p className="truncate text-sm font-medium">
                            {d.countryName}
                            <span className="ml-2 text-xs font-normal text-ink-3">
                              {formatInt(d.offers)} offres
                            </span>
                          </p>
                          <p className="text-right text-sm font-semibold whitespace-nowrap tabular-nums">
                            {formatEurPerGb(d.eurPerGb)}
                          </p>
                          <p className="col-span-2 truncate text-xs text-ink-2">
                            {d.best.provider} · {formatTier(d.best.dataGb)} · {d.best.validityDays}{" "}
                            j · {formatEur(d.best.price)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </Panel>
                </div>
              </div>
            </Section>

            <Section
              id="market"
              title="Comparer fait économiser"
              description="Statistique bonus côté métier : pour un même forfait, l'écart entre fournisseurs, et qui est le moins cher le plus souvent."
            >
              <Market market={s.market} total={s.total} />
            </Section>
          </>
        )}

        {view === "offers" && (
          <Section
            id="products"
            title="Toutes les offres"
            description="Le détail des offres filtrées. Triez, cherchez (sans tenir compte des accents) et exportez la vue au format des fichiers fournisseurs."
          >
            <ProductTable
              products={filtered ?? initialRows}
              pendingTotal={filtered ? undefined : initialStats.total}
            />
          </Section>
        )}
      </div>

      {view === "offers" && (
        <Section
          id="finder"
          title="Quelle eSIM pour mon voyage ?"
          description="La question à laquelle MyBestSim répond, posée au catalogue entier (les filtres ci-dessus ne s'appliquent pas ici) : les offres qui couvrent tout le séjour, de la moins chère à la plus chère."
        >
          <Finder products={products} destinations={options.destinations} />
        </Section>
      )}

      {view === "quality" && <Quality quality={quality} audit={audit} />}
    </div>
  );
}
