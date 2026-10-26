import type { ReactNode } from "react";

interface Props {
  /** Item number from the brief, so each requirement can be ticked off at a glance. */
  index: number;
  label: string;
  children: ReactNode;
  footnote?: ReactNode;
}

export function KpiCard({ index, label, children, footnote }: Props) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-center gap-2">
        <span
          className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2"
          title={`Point ${index} du sujet`}
        >
          {index}
        </span>
        <h3 className="text-sm text-ink-2">{label}</h3>
      </header>
      <div className="mt-3 text-[1.7rem] leading-tight font-semibold tracking-tight tabular-nums sm:text-3xl">
        {children}
      </div>
      {footnote && <p className="mt-auto pt-2 text-xs leading-relaxed text-ink-3">{footnote}</p>}
    </article>
  );
}

interface ValueProps {
  kpi: string;
  value: number | null;
  children: ReactNode;
}

/** Wraps a rendered figure with its raw value so the static HTML stays machine-checkable. */
export function KpiValue({ kpi, value, children }: ValueProps) {
  return (
    <span data-kpi={kpi} data-value={value ?? ""}>
      {children}
    </span>
  );
}
