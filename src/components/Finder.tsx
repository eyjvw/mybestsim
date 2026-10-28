import { useId, useMemo, useState } from "react";
import {
  type DataNeed,
  estimateData,
  type FinderQuery,
  findPlans,
  USAGE_PROFILES,
} from "../lib/finder";
import { formatEur, formatInt, formatTier } from "../lib/format";
import { mybestsimUrl } from "../lib/mybestsim";
import { REGION_NAMES } from "../lib/regions";
import { DATA_TIERS, VALIDITIES } from "../lib/stats";
import type { Product } from "../lib/types";
import { MybestsimLink } from "./Opportunities";
import { ProviderLogo } from "./ProviderLogo";
import { Panel } from "./Section";

interface Props {
  products: Product[] | null;
  destinations: { code: string; name: string; region: boolean }[];
}

const MAX_DAYS = Math.max(...VALIDITIES);
/** Longer trips are accepted so the form can explain why no single offer covers them. */
const MAX_TRIP = 90;
const fieldClass =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-card disabled:opacity-50";

/** "Which eSIM for my trip?": the question MyBestSim answers, on the whole catalog. */
export function Finder({ products, destinations }: Props) {
  const id = useId();
  // Italy by default: it shows how a Europe plan can beat local offers.
  const [q, setQ] = useState<FinderQuery>(() => ({
    destination: destinations.some((d) => d.code === "IT") ? "IT" : (destinations[0]?.code ?? ""),
    data: 5,
    days: 10,
    regional: true,
  }));
  // Raw text, so the field can be cleared while typing; the query keeps the last valid value.
  const [daysText, setDaysText] = useState("10");
  const set = <K extends keyof FinderQuery>(k: K, v: FinderQuery[K]) =>
    setQ((prev) => ({ ...prev, [k]: v }));
  const result = useMemo(() => (products ? findPlans(products, q) : null), [products, q]);
  const destName = destinations.find((d) => d.code === q.destination)?.name ?? q.destination;
  const destUrl = mybestsimUrl(q.destination);
  const best = result?.matches[0];
  const regionalSaving =
    best?.viaRegion && result?.cheapestLocal
      ? result.cheapestLocal.price - best.product.price
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <Panel
        title="Votre voyage"
        note="Les besoins en data par profil sont des estimations : à ajuster selon vos habitudes."
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()} data-finder-form>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-3">Destination</span>
            <select
              className={fieldClass}
              value={q.destination}
              disabled={!products}
              onChange={(e) => set("destination", e.target.value)}
              name="destination"
            >
              <optgroup label="Pays">
                {destinations
                  .filter((d) => !d.region)
                  .map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Régions">
                {destinations
                  .filter((d) => d.region)
                  .map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-3">Durée du séjour (jours)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_TRIP}
                className={fieldClass}
                value={daysText}
                disabled={!products}
                name="days"
                onChange={(e) => {
                  setDaysText(e.target.value);
                  const n = Math.round(Number(e.target.value));
                  if (e.target.value !== "" && n >= 1 && n <= MAX_TRIP) set("days", n);
                }}
                onBlur={() => setDaysText(String(q.days))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-3">Data minimum</span>
              <select
                className={fieldClass}
                value={String(q.data)}
                disabled={!products}
                name="data"
                onChange={(e) => {
                  const v = e.target.value;
                  set("data", (v === "unlimited" ? v : Number(v)) as DataNeed);
                }}
              >
                {DATA_TIERS.map((t) => (
                  <option key={String(t)} value={t === null ? "unlimited" : t}>
                    {formatTier(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset disabled={!products}>
            <legend className="mb-1 text-xs text-ink-3">
              Je ne sais pas combien de data : estimer selon mon usage
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {USAGE_PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.hint} · environ ${String(p.gbPerDay).replace(".", ",")} Go par jour`}
                  onClick={() => set("data", estimateData(q.days, p.gbPerDay))}
                  className="rounded-full border border-accent/25 bg-accent-tint px-3 py-1 text-sm font-medium text-accent hover:border-accent/60"
                >
                  {p.label}
                  <span className="ml-1 text-xs text-ink-3">
                    ~{String(p.gbPerDay).replace(".", ",")} Go/j
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--accent)]"
              checked={q.regional}
              disabled={!products}
              onChange={(e) => set("regional", e.target.checked)}
              aria-describedby={`${id}-regional`}
            />
            <span>
              Inclure les forfaits régionaux
              <span id={`${id}-regional`} className="block text-xs text-ink-3">
                Europe, Asie, Amérique du Nord ou Monde, quand ils couvrent la destination.
              </span>
            </span>
          </label>
        </form>
      </Panel>

      <Panel
        title={`Meilleures offres : ${destName}, ${q.days} jour${q.days > 1 ? "s" : ""}, ${q.data === "unlimited" ? "illimité" : `${q.data} Go minimum`}`}
      >
        <div aria-live="polite" data-finder-result>
          {!result ? (
            <p className="py-6 text-sm text-ink-3">Chargement du catalogue…</p>
          ) : result.matches.length === 0 ? (
            <p className="py-6 text-sm text-ink-2">
              Aucune offre ne couvre ce séjour. Les forfaits du catalogue durent {MAX_DAYS} jours au
              plus : pour un séjour plus long, prenez une offre rechargeable ou deux forfaits.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                <strong className="font-semibold text-ink" data-finder-eligible={result.eligible}>
                  {formatInt(result.eligible)} offres
                </strong>{" "}
                conviennent, au prix médian de {formatEur(result.medianPrice)}.
                {regionalSaving !== null && regionalSaving > 0 && (
                  <>
                    {" "}
                    Le forfait {REGION_NAMES[best?.viaRegion ?? ""]} fait économiser{" "}
                    <strong className="font-semibold text-ink">{formatEur(regionalSaving)}</strong>{" "}
                    par rapport à la meilleure offre {destName}.
                  </>
                )}
              </p>
              <ol className="mt-3 divide-y divide-line/70">
                {result.matches.map((m, i) => (
                  <li
                    key={m.product.sku}
                    data-finder-sku={m.product.sku}
                    data-finder-price={m.product.price}
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 py-2.5"
                  >
                    <span className="text-xs font-semibold text-accent tabular-nums">{i + 1}.</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        <ProviderLogo
                          provider={m.product.provider}
                          className="relative -top-px mr-1.5"
                        />
                        {/* Wraps between parts on a phone, never inside one ("15 / j"). */}
                        <span className="whitespace-nowrap">{m.product.provider}</span> ·{" "}
                        <span className="whitespace-nowrap">{formatTier(m.product.dataGb)}</span> ·{" "}
                        <span className="whitespace-nowrap">{m.product.validityDays} j</span>
                        {i === 0 && (
                          <span className="ml-2 inline-block rounded-full bg-warn px-2 py-0.5 align-middle text-[10px] font-semibold whitespace-nowrap text-[#0f172a] uppercase">
                            Meilleur prix
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-2">
                        {m.viaRegion ? `Forfait ${REGION_NAMES[m.viaRegion]} · ` : ""}
                        {m.product.network}
                        {m.product.topUp ? " · rechargeable" : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {formatEur(m.product.price)}
                      </span>
                      {m.saving > 0 && (
                        <span className="block text-xs text-ink-3 tabular-nums">
                          −{formatEur(m.saving)} vs médiane
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              {destUrl && (
                <p className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3 text-sm text-ink-2">
                  <span>Toutes les offres {destName}, sur le comparateur :</span>
                  <MybestsimLink url={destUrl} look="button">
                    Comparer sur MyBestSim
                  </MybestsimLink>
                </p>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
