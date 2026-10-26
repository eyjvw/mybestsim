export interface BarItem {
  label: string;
  value: number;
  /** Text shown at the end of the row. */
  display: string;
  /** Extra line revealed on hover / focus. */
  detail?: string;
}

interface Props {
  items: BarItem[];
  /** Accessible description of what the bars measure. */
  caption: string;
}

/** Ranked horizontal bars, single series: one hue, thin marks, direct value labels. */
export function BarList({ items, caption }: Props) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0) return <p className="py-6 text-sm text-ink-3">Aucune donnée.</p>;
  return (
    <ul className="space-y-1" aria-label={caption}>
      {items.map((item) => (
        <li
          key={item.label}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals the tooltip for keyboard users
          tabIndex={0}
          aria-label={`${item.label} : ${item.display}${item.detail ? `, ${item.detail}` : ""}`}
          className="group relative grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-surface-2 focus-visible:bg-surface-2 sm:grid-cols-[9rem_1fr_auto]"
        >
          <span className="truncate text-sm text-ink-2">{item.label}</span>
          <span className="h-2.5 rounded-r bg-track">
            <span
              className="block h-full rounded-r bg-s1 transition-[width] duration-300"
              style={{ width: `${max ? (item.value / max) * 100 : 0}%` }}
            />
          </span>
          <span className="min-w-14 text-right text-sm font-medium tabular-nums">
            {item.display}
          </span>
          {item.detail && (
            <span
              role="tooltip"
              className="pointer-events-none absolute right-2 bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-lg group-hover:block group-focus-visible:block"
            >
              <strong className="font-semibold text-ink">{item.label}</strong> · {item.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
