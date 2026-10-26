import { activeFilterCount, DEFAULT_FILTERS, type Filters } from "../lib/filters";
import { formatInt, formatTier } from "../lib/format";
import { DATA_TIERS, VALIDITIES } from "../lib/stats";

export interface FilterOptions {
  providers: string[];
  destinations: { code: string; name: string; region: boolean }[];
}

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  options: FilterOptions;
  shown: number;
  total: number;
  ready: boolean;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T | "all";
  options: { value: T | "all"; label: string }[];
  onChange: (v: T | "all") => void;
  disabled: boolean;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-1 text-xs text-ink-3">{label}</legend>
      <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="rounded-md px-2 py-1 text-sm whitespace-nowrap text-ink-2 sm:px-2.5 transition-colors hover:text-ink disabled:opacity-50 aria-pressed:bg-surface aria-pressed:font-medium aria-pressed:text-ink aria-pressed:shadow-sm"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink disabled:opacity-50";

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

  return (
    <section
      id="filters"
      aria-label="Filtres"
      className="z-20 -mx-4 border-b border-line bg-page px-4 py-3 sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:shadow-[0_8px_16px_-12px_rgb(0_0_0/0.15)]"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:flex lg:flex-wrap lg:items-end">
        <label className="block lg:w-44">
          <span className="mb-1 block text-xs text-ink-3">Fournisseur</span>
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
          <span className="mb-1 block text-xs text-ink-3">Zone</span>
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
          <span className="mb-1 block text-xs text-ink-3">Destination</span>
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
          <span className="mb-1 block text-xs text-ink-3">Data</span>
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
          <p className="text-sm text-ink-2" aria-live="polite">
            <strong className="font-semibold text-ink tabular-nums">{formatInt(shown)}</strong>{" "}
            carte
            {shown > 1 ? "s" : ""} sur {formatInt(total)}
          </p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            disabled={active === 0}
            className="text-sm font-medium text-s1 underline-offset-2 hover:underline disabled:cursor-default disabled:text-ink-3 disabled:no-underline"
          >
            Réinitialiser{active > 0 ? ` (${active})` : ""}
          </button>
        </div>
      </div>
      {!ready && <p className="mt-2 text-xs text-ink-3">Chargement du catalogue…</p>}
    </section>
  );
}
