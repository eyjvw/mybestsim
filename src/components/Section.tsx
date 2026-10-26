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
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-28 ${className}`}>
      <div className="mb-4">
        <h2
          id={`${id}-title`}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          {index !== undefined && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs font-semibold text-page">
              {index}
            </span>
          )}
          {title}
        </h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
      {note && <p className="mt-3 text-xs leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}
