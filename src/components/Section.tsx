import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  index?: number | string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ id, title, index, description, children, className = "" }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`min-w-0 scroll-mt-28 ${className}`}
    >
      <div className="mb-4">
        <h2
          id={`${id}-title`}
          className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl"
        >
          {index !== undefined && (
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
              {index}
            </span>
          )}
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Card for one chart or table. `min-w-0` lets it shrink inside a grid track: without it a
 * wide child (a table with a min width) widens the track and the whole page scrolls sideways.
 */
export function Panel({
  title,
  children,
  note,
  action,
  level = 3,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  /** Heading level: 3 inside a section, 2 on a page without sections (/import). */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="min-w-0 rounded-[18px] border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Heading className="text-[15px] font-semibold">{title}</Heading>
        {action}
      </div>
      {children}
      {note && <p className="mt-3 text-xs leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}
