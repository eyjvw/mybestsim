import type { ReactNode } from "react";

export interface BarItem {
  label: string;
  /** Shown before the label, such as a provider logo. */
  icon?: ReactNode;
  value: number;
  /** Text shown at the end of the row. */
  display: string;
  /** Secondary figure printed next to the value (share, offer count…). */
  detail?: string;
}

interface Props {
  items: BarItem[];
  /** Accessible description of what the bars measure. */
  caption: string;
  /** Split long lists into two columns on wide screens. */
  wide?: boolean;
}

/**
 * Ranked horizontal bars, single series: one hue, thin marks, direct value labels.
 * Every figure is printed, so nothing depends on hover (touch screens have none).
 */
export function BarList({ items, caption, wide = false }: Props) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0) return <p className="py-6 text-sm text-ink-3">Aucune donnée.</p>;
  // An icon takes 26 px of the label column: widen it so names like "Maya Mobile" still fit.
  const cols = items.some((i) => i.icon)
    ? "grid-cols-[8rem_minmax(0,1fr)_auto] sm:grid-cols-[10.5rem_minmax(0,1fr)_8.5rem]"
    : "grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:grid-cols-[9rem_minmax(0,1fr)_8.5rem]";
  return (
    <ul
      className={
        wide ? "gap-x-10 space-y-0.5 xl:columns-2 [&>li]:break-inside-avoid" : "space-y-0.5"
      }
      aria-label={caption}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className={`grid ${cols} items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-2 sm:gap-3 sm:px-2`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {item.icon}
            <span className="truncate text-sm text-ink-2" title={item.label} data-bar-label>
              {item.label}
            </span>
          </span>
          <span className="h-2.5 rounded-r bg-track">
            <span
              className="block h-full rounded-r bg-s1 transition-[width] duration-300"
              style={{ width: `${max ? (item.value / max) * 100 : 0}%` }}
            />
          </span>
          <span className="text-right text-sm whitespace-nowrap tabular-nums">
            <span className="font-medium">{item.display}</span>
            {item.detail && <span className="ml-1.5 text-xs text-ink-3">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
