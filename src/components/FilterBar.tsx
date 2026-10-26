import { useState } from "react";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  type FilterOptions,
  type Filters,
} from "../lib/filters";
import { formatInt, formatTier } from "../lib/format";
import { DATA_TIERS, VALIDITIES } from "../lib/stats";

export type { FilterOptions };

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  options: FilterOptions;
  shown: number;
  total: number;
  ready: boolean;
}

/** Copies the current URL, which carries the filters, so a view can be shared as is. */
function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(window.location.href)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => {});
      }}
      className="text-sm font-medium text-accent underline-offset-2 hover:underline"
    >
      <span aria-live="polite">{copied ? "Lien copié" : "Copier le lien"}</span>
    </button>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T | "all";
  options: { value: T | "all"; label: string }[];
  onChange: (v: T | "all") => void;
  disabled: boolean;
  className?: string;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  className = "",
}: SegmentedProps<T>) {
  return (
    <fieldset className={`min-w-0 ${className}`} disabled={disabled}>
      <legend className="mb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
        {label}
      </legend>
      {/* Pill chips, like the filters of the mybestsim.com comparator. */}
      <div className="flex max-w-full flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="h-8 rounded-full border border-accent/25 bg-accent-tint px-3 text-sm font-medium whitespace-nowrap text-accent transition-colors hover:border-accent/60 disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const selectClass =
  "h-9 w-full rounded-[18px] border border-line bg-surface shadow-card px-3 text-sm text-ink shadow-card disabled:opacity-50";

export function FilterBar({ filters, onChange, options, shown, total, ready }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const next = { ...filters, [key]: value };
    // Keep destination consistent with the zone it belongs to.
    if (key === "zone" && next.destination !== "all") {
      const d = options.destinations.find((x) => x.code === next.destination);
      if (d && value !== "all" && d.region !== (value === "region")) next.destination = "all";
    }
    onChange(next);
  };
  const destinations = options.destinations.filter(
    (d) => filters.zone === "all" || d.region === (filters.zone === "region"),
  );
  const active = activeFilterCount(filters);
  const [open, setOpen] = useState(false);
  const count = (
    <p className="text-sm text-ink-2" aria-live="polite">
      <strong className="font-semibold text-ink tabular-nums" data-shown={shown}>
        {formatInt(shown)}
      </strong>{" "}
      carte{shown > 1 ? "s" : ""} sur {formatInt(total)}
    </p>
  );
  const reset = (
    <button
      type="button"
      onClick={() => onChange(DEFAULT_FILTERS)}
      disabled={active === 0}
      className="text-sm font-medium text-accent underline-offset-2 hover:underline disabled:cursor-default disabled:text-ink-3 disabled:no-underline"
    >
      Réinitialiser{active > 0 ? ` (${active})` : ""}
    </button>
  );

  return (
    <section
      id="filters"
      aria-label="Filtres"
      className="sticky top-0 z-20 -mx-4 border-b border-line bg-page/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-3 2xl:-mx-14 2xl:px-14 lg:shadow-[0_8px_16px_-12px_rgb(0_0_0/0.15)]"
    >
      {/* Small screens: one compact row; the controls open on demand so KPIs stay in view. */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="filter-controls"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-card"
        >
          Filtres
          {active > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] text-on-accent tabular-nums">
              {active}
            </span>
          )}
          <span
            aria-hidden="true"
            className={`text-xs text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        <div className="flex items-center gap-3">
          {count}
          {active > 0 && reset}
        </div>
      </div>
      <div
        id="filter-controls"
        className={`${open ? "grid" : "hidden"} mt-3 grid-cols-2 gap-3 md:grid-cols-4 lg:mt-0 lg:flex lg:flex-wrap lg:items-end`}
      >
        <label className="block lg:w-44">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Fournisseur
          </span>
          <select
            className={selectClass}
            disabled={!ready}
            value={filters.provider}
            onChange={(e) => set("provider", e.target.value)}
          >
            <option value="all">Tous</option>
            {options.providers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block lg:w-36">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Zone
          </span>
          <select
            className={selectClass}
            disabled={!ready}
            value={filters.zone}
            onChange={(e) => set("zone", e.target.value as Filters["zone"])}
          >
            <option value="all">Toutes</option>
            <option value="country">Pays</option>
            <option value="region">Régions</option>
          </select>
        </label>
        <label className="block lg:w-48">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Destination
          </span>
          <select
            className={selectClass}
            disabled={!ready}
            value={filters.destination}
            onChange={(e) => set("destination", e.target.value)}
          >
            <option value="all">Toutes</option>
            {destinations.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block lg:w-32">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Data
          </span>
          <select
            className={selectClass}
            disabled={!ready}
            value={String(filters.data)}
            onChange={(e) => {
              const v = e.target.value;
              set("data", v === "all" || v === "unlimited" ? v : Number(v));
            }}
          >
            <option value="all">Toutes</option>
            {DATA_TIERS.map((t) => (
              <option key={String(t)} value={t === null ? "unlimited" : t}>
                {formatTier(t)}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Réseau"
          value={filters.network}
          disabled={!ready}
          onChange={(v) => set("network", v)}
          options={[
            { value: "all", label: "Tous" },
            { value: "4G", label: "4G" },
            { value: "5G", label: "5G" },
          ]}
        />
        <Segmented
          label="Durée"
          className="max-sm:col-span-2 md:col-span-2"
          value={filters.validity}
          disabled={!ready}
          onChange={(v) => set("validity", v)}
          options={[
            { value: "all", label: "Toutes" },
            ...VALIDITIES.map((d) => ({ value: d, label: `${d} j` })),
          ]}
        />
        <Segmented
          label="Recharge"
          value={filters.topUp}
          disabled={!ready}
          onChange={(v) => set("topUp", v)}
          options={[
            { value: "all", label: "Toutes" },
            { value: "yes", label: "Oui" },
            { value: "no", label: "Non" },
          ]}
        />
        <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-4 lg:ml-auto lg:block lg:text-right">
          <div className="hidden lg:block">{count}</div>
          <div className="flex items-center gap-4 lg:justify-end">
            <ShareButton />
            <span className="hidden lg:inline">{reset}</span>
          </div>
        </div>
      </div>
      {!ready && <p className="mt-2 text-xs text-ink-3">Chargement du catalogue…</p>}
    </section>
  );
}
