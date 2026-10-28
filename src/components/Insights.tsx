import type { Insight } from "../lib/insights";

interface Props {
  insights: Insight[];
  /** One card per row, for a half-width column. */
  stacked?: boolean;
}

/** "À retenir": findings computed from the current selection, never fixed copy. */
export function Insights({ insights, stacked = false }: Props) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        Pas assez d'offres dans la sélection pour en tirer un constat.
      </p>
    );
  }
  return (
    <ol className={`grid gap-3 ${stacked ? "" : "sm:grid-cols-2 xl:grid-cols-4"}`} data-insights>
      {insights.map((i, n) => (
        <li
          key={i.id}
          data-insight={i.id}
          className="flex min-w-0 flex-col rounded-[18px] border border-line bg-surface shadow-card p-4"
        >
          <span className="text-xs font-semibold text-accent tabular-nums">
            {String(n + 1).padStart(2, "0")}
          </span>
          <p className="mt-1 text-[15px] leading-snug font-semibold text-balance">{i.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{i.detail}</p>
        </li>
      ))}
    </ol>
  );
}
