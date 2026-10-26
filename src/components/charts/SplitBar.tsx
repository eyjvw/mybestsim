import { formatInt, formatPct } from "../../lib/format";

export interface Segment {
  label: string;
  count: number;
  share: number;
}

const COLORS = ["bg-s1", "bg-s2", "bg-s3"] as const;

interface Props {
  title: string;
  segments: Segment[];
}

/**
 * 100 % stacked bar for 2-3 categories. Fixed slot order (never by rank),
 * 2px gaps between fills, and a direct-labelled legend so color never carries identity alone.
 */
export function SplitBar({ title, segments }: Props) {
  const visible = segments.filter((s) => s.count > 0);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{title}</p>
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded bg-track"
        role="img"
        aria-label={title}
      >
        {visible.map((s) => (
          <span
            key={s.label}
            title={`${s.label} : ${formatInt(s.count)} (${formatPct(s.share)})`}
            className={`h-full transition-[width] duration-300 ${COLORS[segments.indexOf(s)]}`}
            style={{ width: `${s.share * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${COLORS[i]}`} aria-hidden="true" />
            <span className="text-ink">{s.label}</span>
            <span className="tabular-nums">
              {formatPct(s.share)} · {formatInt(s.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
