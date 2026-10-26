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

/** Vertical bars anchored on a shared baseline, value on each cap, count under each label. */
export function ColumnChart({ columns, caption }: Props) {
  const max = Math.max(...columns.map((c) => c.value), 0);
  if (columns.length === 0) return <p className="py-6 text-sm text-ink-3">Aucune donnée.</p>;
  return (
    <figure aria-label={caption}>
      <div className="flex h-44 items-end gap-1 border-b border-rule sm:gap-2">
        {columns.map((c) => (
          <div
            key={c.label}
            role="img"
            aria-label={`${c.label} : ${c.display}, ${c.detail}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
          >
            <span className="mb-1 text-[11px] font-medium whitespace-nowrap tabular-nums text-ink-2 sm:text-xs">
              {c.display}
            </span>
            <span
              className="block w-3/5 max-w-6 rounded-t bg-s1 transition-[height] duration-300"
              style={{ height: `${max ? (c.value / max) * 78 : 0}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 sm:gap-2">
        {columns.map((c) => (
          <span key={c.label} className="min-w-0 flex-1 text-center leading-tight">
            <span className="block truncate text-xs text-ink-2">{c.label}</span>
            <span className="block truncate text-[10px] text-ink-3 tabular-nums">{c.detail}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
