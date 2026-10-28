import { formatEur, formatEurRound, formatInt } from "../../lib/format";
import type { HistogramBin } from "../../lib/stats";

interface Marker {
  label: string;
  /** Tag printed on the plot, next to the hairline. */
  short: string;
  value: number;
}

interface Threshold {
  value: number;
  /** Offers strictly above the value, printed on the shaded band. */
  over: number;
}

interface Props {
  bins: HistogramBin[];
  caption: string;
  /** Reference values drawn as hairlines across the plot (median, mean). */
  markers?: Marker[];
  /** Shades the range above a price (the brief's 100 €) and prints how many offers it holds. */
  threshold?: Threshold;
}

/**
 * Price distribution: touching columns split by a 2px surface gap, one hue, a hairline per
 * reference value with its label in text ink, and the counts available as a table.
 */
export function Histogram({ bins, caption, markers = [], threshold }: Props) {
  if (bins.length === 0) return <p className="py-6 text-sm text-ink-3">Aucune donnée.</p>;
  const max = Math.max(...bins.map((b) => b.count));
  const top = bins[bins.length - 1].to;
  const x = (v: number) => `${(v / top) * 100}%`;
  const ticks = bins.filter((b) => b.from % 50 === 0).map((b) => b.from);
  const peak = bins.reduce((a, b) => (b.count > a.count ? b : a));
  const ordered = [...markers].sort((a, b) => a.value - b.value);

  return (
    <figure
      aria-label={caption}
      data-price-histogram={threshold ? "" : undefined}
      data-threshold={threshold?.value}
      data-over={threshold?.over}
    >
      <div className="relative">
        <div className="relative flex h-40 items-end gap-0.5 border-b border-rule pt-8">
          {threshold && threshold.value < top && (
            // The few offers above the threshold are too low to see as bars: the band and its
            // count make them visible, and the count is the brief's KPI 2.
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 bottom-0 border-l border-dashed border-ink-2 bg-s2/10"
              style={{ left: x(threshold.value) }}
            >
              <span className="absolute top-0 right-1 text-right text-[11px] leading-tight text-ink-2">
                plus de {formatEurRound(threshold.value)}
                <br />
                <span className="font-semibold text-ink tabular-nums">
                  {formatInt(threshold.over)} offres
                </span>
              </span>
            </div>
          )}
          {bins.map((b) => (
            <div
              key={b.from}
              role="img"
              aria-label={`${formatEur(b.from)} à ${formatEur(b.to)} : ${formatInt(b.count)} offres`}
              title={`${formatEur(b.from)} – ${formatEur(b.to)} : ${formatInt(b.count)} offres`}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className="block w-full rounded-t-[3px] bg-s1 transition-[height] duration-300"
                style={{ height: `${max ? (b.count / max) * 100 : 0}%` }}
              />
            </div>
          ))}
          {ordered.map((m, i) => (
            <div
              key={m.label}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-ink-2"
              style={{ left: x(m.value) }}
            >
              {/* Short tags, staggered so close values never collide; full values below. */}
              <span
                className="absolute left-1 text-[11px] leading-none whitespace-nowrap text-ink-2"
                style={{ top: `${i * 14}px` }}
              >
                {m.short}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[11px] whitespace-nowrap text-ink-3 tabular-nums">
          {ticks.map((t) => (
            <span
              key={t}
              className={`absolute ${t === 0 ? "" : "-translate-x-1/2"}`}
              style={{ left: x(t) }}
            >
              {t} €
            </span>
          ))}
        </div>
      </div>
      {ordered.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {ordered.map((m) => (
            <li key={m.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-px bg-ink-2" />
              {m.label} ({m.short}) :{" "}
              <span className="font-medium text-ink tabular-nums">{formatEur(m.value)}</span>
            </li>
          ))}
        </ul>
      )}
      <figcaption className="mt-1 text-xs text-ink-3">
        Tranches de 10 €. La plus fournie : {formatEur(peak.from)} à {formatEur(peak.to)} (
        {formatInt(peak.count)} offres).
      </figcaption>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-ink-2">Voir les données</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left text-ink-3">
              <th scope="col" className="py-0.5 font-medium">
                Tranche
              </th>
              <th scope="col" className="py-0.5 text-right font-medium">
                Offres
              </th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.from} className="border-t border-line/60">
                <td className="py-0.5">
                  {b.from} – {b.to} €
                </td>
                <td className="py-0.5 text-right">{formatInt(b.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
