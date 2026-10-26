import { useMemo, useState } from "react";
import { formatEur, formatEurPerGb, formatInt, formatTier } from "../lib/format";
import { eurPerGb } from "../lib/stats";
import type { Product } from "../lib/types";

type SortKey =
  | "name"
  | "provider"
  | "countryName"
  | "dataGb"
  | "validityDays"
  | "price"
  | "eurPerGb";
type Dir = "asc" | "desc";

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

// Unlimited offers sort after every finite volume; their €/Go is undefined, so they sort last.
function sortValue(p: Product, key: SortKey): number | string {
  if (key === "dataGb") return p.dataGb ?? Number.POSITIVE_INFINITY;
  if (key === "eurPerGb") return eurPerGb(p) ?? Number.POSITIVE_INFINITY;
  return p[key];
}

export function sortProducts(products: Product[], key: SortKey, dir: Dir): Product[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...products].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    const c =
      typeof va === "string"
        ? va.localeCompare(vb as string, "fr")
        : (va as number) - (vb as number);
    return c !== 0 ? c * sign : a.sku.localeCompare(b.sku);
  });
}

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

  const toggle = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
    setPage(0);
  };

  return (
    <div className="rounded-xl border border-line bg-surface">
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
            className="h-9 w-full rounded-lg border border-line bg-page px-3 text-sm placeholder:text-ink-3"
          />
        </label>
        <p className="text-sm text-ink-2" aria-live="polite">
          {formatInt(count)} résultat{count > 1 ? "s" : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
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
          className="rounded-md px-2 py-1 hover:bg-surface-2 disabled:opacity-40"
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
          className="rounded-md px-2 py-1 hover:bg-surface-2 disabled:opacity-40"
        >
          Suivant →
        </button>
      </nav>
    </div>
  );
}
