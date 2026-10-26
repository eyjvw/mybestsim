export interface Column {
  label: string;
  value: number;
  display: string;
  detail: string;
}

interface Props {
  columns: Column[];
  caption: string;
}

/** Vertical bars anchored on a shared baseline, value labels above each mark. */
export function ColumnChart({ columns, caption }: Props) {
  const max = Math.max(...columns.map((c) => c.value), 0);
  if (columns.length === 0) return <p className="py-6 text-sm text-ink-3">Aucune donnée.</p>;
  return (
    <figure aria-label={caption}>
      <div className="flex h-48 items-end gap-2 border-b border-line">
        {columns.map((c) => (
          <div
            key={c.label}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals the tooltip for keyboard users
            tabIndex={0}
            role="img"
            aria-label={`${c.label} : ${c.display}, ${c.detail}`}
            className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-t-md outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
          >
            <span className="mb-1 text-xs font-medium tabular-nums text-ink-2">{c.display}</span>
            <span
              className="block w-3/5 max-w-10 rounded-t bg-s1 transition-[height] duration-300"
              style={{ height: `${max ? (c.value / max) * 80 : 0}%` }}
            />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-lg group-hover:block group-focus-visible:block"
            >
              <strong className="font-semibold text-ink">{c.label}</strong> · {c.detail}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {columns.map((c) => (
          <span key={c.label} className="flex-1 text-center text-xs text-ink-3">
            {c.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
