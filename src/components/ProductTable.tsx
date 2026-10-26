import { useMemo, useState } from "react";
import { toSupplierCsv } from "../lib/export";
import { formatEur, formatEurPerGb, formatInt, formatTier } from "../lib/format";
import { type SortDir as Dir, type SortKey, sortProducts } from "../lib/sort";
import { eurPerGb } from "../lib/stats";
import type { Product } from "../lib/types";

const PAGE_SIZE = 15;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Offre" },
  { key: "provider", label: "Fournisseur" },
  { key: "countryName", label: "Destination" },
  { key: "dataGb", label: "Data", numeric: true },
  { key: "validityDays", label: "Durée", numeric: true },
  { key: "price", label: "Prix", numeric: true },
  { key: "eurPerGb", label: "€/Go", numeric: true },
];

const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

interface Props {
  products: Product[];
  /** Real result count while only the server-rendered first page is available. */
  pendingTotal?: number;
}

export function ProductTable({ products, pendingTotal }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "price", dir: "asc" });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = normalise(query.trim());
    const hit = q
      ? products.filter((p) =>
          normalise(`${p.name} ${p.provider} ${p.countryName} ${p.sku}`).includes(q),
        )
      : products;
    return sortProducts(hit, sort.key, sort.dir);
  }, [products, query, sort]);

  const count = pendingTotal ?? rows.length;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const exportCsv = () => {
    // Same columns as the supplier files: the export can be re-imported in /import.
    const blob = new Blob([toSupplierCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "offres-mybestsim.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
    setPage(0);
  };

  return (
    <div className="rounded-[18px] border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-80">
          <span className="sr-only">Rechercher une offre</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Rechercher : Japon, Holafly, 20 Go…"
            className="h-10 w-full rounded-full border border-line bg-surface px-4 text-sm shadow-card placeholder:text-ink-3"
          />
        </label>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="text-sm text-ink-2" aria-live="polite" data-results={count}>
            {formatInt(count)} résultat{count > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={pendingTotal !== undefined || rows.length === 0}
            className="rounded-full border border-accent/30 bg-surface px-4 py-1.5 text-sm font-semibold text-accent hover:border-accent disabled:opacity-50"
          >
            Exporter en CSV
          </button>
        </div>
      </div>
      {/* Small screens: one card per offer, sorted with the same control as the table. */}
      <div className="md:hidden">
        <label className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
          <span className="text-ink-3">Trier par</span>
          <select
            className="h-9 rounded-full border border-line bg-surface px-3 text-sm"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, Dir];
              setSort({ key, dir });
              setPage(0);
            }}
          >
            {COLUMNS.flatMap((c) => [
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>
                {c.label} {c.numeric ? "croissant" : "A → Z"}
              </option>,
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>
                {c.label} {c.numeric ? "décroissant" : "Z → A"}
              </option>,
            ])}
          </select>
        </label>
        <ul className="divide-y divide-line/70">
          {visible.map((p) => (
            <li key={p.sku} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-xs text-ink-2">
                  {p.provider} · {p.network}
                  {p.topUp ? " · rechargeable" : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">
                  {formatEur(p.price)}
                </span>
                <span className="block text-xs text-ink-3 tabular-nums">
                  {formatEurPerGb(eurPerGb(p))}
                </span>
              </span>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-ink-3">
              Aucune offre ne correspond.
            </li>
          )}
        </ul>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                  }
                  className={`px-3 py-2 font-medium ${c.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {c.label}
                    <span aria-hidden="true" className="w-2 text-[10px]">
                      {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.sku} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <span className="text-ink">{p.name}</span>
                  <span className="ml-2 text-xs text-ink-3">
                    {p.network}
                    {p.topUp ? " · rechargeable" : ""}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-2">{p.provider}</td>
                <td className="px-3 py-2 text-ink-2">{p.countryName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTier(p.dataGb)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.validityDays} j</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatEur(p.price)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-2">
                  {formatEurPerGb(eurPerGb(p))}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-ink-3">
                  Aucune offre ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="Pagination"
        className="flex items-center justify-between border-t border-line px-3 py-2 text-sm text-ink-2"
      >
        <button
          type="button"
          onClick={() => setPage(current - 1)}
          disabled={current === 0}
          className="rounded-full border border-accent/30 bg-surface px-4 py-1.5 font-semibold text-accent shadow-card transition-colors hover:border-accent hover:bg-accent-tint disabled:border-line disabled:text-ink-3 disabled:shadow-none"
        >
          ← Précédent
        </button>
        <span className="tabular-nums">
          Page {current + 1} / {pages}
        </span>
        <button
          type="button"
          onClick={() => setPage(current + 1)}
          disabled={current >= pages - 1}
          className="rounded-full border border-accent/30 bg-surface px-4 py-1.5 font-semibold text-accent shadow-card transition-colors hover:border-accent hover:bg-accent-tint disabled:border-line disabled:text-ink-3 disabled:shadow-none"
        >
          Suivant →
        </button>
      </nav>
    </div>
  );
}
