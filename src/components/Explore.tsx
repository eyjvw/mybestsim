import type { Audit } from "../lib/audit";
import { formatEur, formatInt, formatPct } from "../lib/format";
import type { Stats } from "../lib/stats";

interface Props {
  stats: Stats;
  audit: Audit;
}

/** The home page stays light: each card leads to a sub-page, with the figure that makes it worth a click. */
export function Explore({ stats: s, audit }: Props) {
  const gap = s.market.biggestGaps[0];
  const cards = [
    {
      href: "/analyse",
      index: 7,
      title: "Analyse et économies",
      figure: gap ? formatEur(gap.max - gap.min) : formatInt(s.market.comparable),
      caption: gap
        ? "d'écart maximal pour un même forfait, prix au Go, paliers, distribution des prix"
        : "forfaits comparables, prix au Go, paliers, distribution des prix",
    },
    {
      href: "/offres",
      title: "Offres et simulateur",
      figure: formatInt(s.total),
      caption: "offres à trier, chercher et exporter, et la meilleure eSIM pour un voyage",
    },
    {
      href: "/qualite",
      title: "Qualité des données",
      figure: formatInt(audit.duplicates.length + audit.outliers.length + audit.dominated.length),
      caption: `points à vérifier (doublons, prix atypiques, incohérences), et les choix assumés · ${formatPct(
        s.market.efficient.share,
      )} des offres imbattables`,
    },
  ];
  return (
    <section aria-labelledby="explore-title" id="explore" className="min-w-0 scroll-mt-28">
      <h2 id="explore-title" className="text-xl font-bold tracking-tight sm:text-2xl">
        Explorer le catalogue
      </h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href} className="min-w-0">
            <a
              href={c.href}
              data-keep-filters
              data-explore={c.href}
              className="group flex h-full flex-col rounded-[18px] border border-line bg-surface p-5 shadow-card transition-colors hover:border-accent/50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {c.index && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
                    {c.index}
                  </span>
                )}
                {c.title}
              </span>
              <span className="mt-3 text-3xl font-bold">{c.figure}</span>
              <span className="mt-1 text-sm leading-relaxed text-ink-2">{c.caption}</span>
              <span className="mt-auto pt-3 text-sm font-semibold text-accent group-hover:underline">
                Voir le détail →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
