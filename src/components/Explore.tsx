import { formatEur, formatInt } from "../lib/format";
import type { Stats } from "../lib/stats";
import type { QualityReport } from "../lib/types";

interface Props {
  stats: Stats;
  quality: QualityReport;
}

/** The home page stays light: each card leads to a sub-page, with the figure that makes it worth a click. */
export function Explore({ stats: s, quality }: Props) {
  const gap = s.market.biggestGaps[0];
  const rejected = quality.rejected.length;
  const cards = [
    {
      href: "/analyse",
      index: 7,
      title: "Analyse et économies",
      figure: gap ? formatEur(gap.max - gap.min) : formatInt(s.market.comparable),
      caption: `${gap ? "d'écart pour un même forfait" : "forfaits comparables"}. Prix au Go, volumes, fournisseurs les moins chers.`,
      filters: true,
    },
    {
      href: "/offres",
      title: "Toutes les offres",
      figure: formatInt(s.total),
      caption: "offres à trier et exporter, et le simulateur « quelle eSIM pour mon voyage ? »",
      filters: true,
    },
    {
      href: "/qualite",
      title: "Qualité des données",
      figure: formatInt(rejected),
      caption: `${rejected > 1 ? "lignes rejetées" : "ligne rejetée"} sur ${formatInt(quality.files)} fichiers. Doublons, prix atypiques et choix de calcul.`,
      filters: true,
    },
    {
      href: "/import",
      title: "Tester un import",
      figure: "Sans jeton",
      caption: "Déposez un fichier fournisseur, vérifiez-le et publiez-le dans un bac à sable.",
      filters: false,
    },
  ];
  return (
    <section aria-labelledby="explore-title" id="explore" className="min-w-0 scroll-mt-28">
      <h2 id="explore-title" className="text-xl font-bold tracking-tight sm:text-2xl">
        Aller plus loin
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.href} className="min-w-0">
            <a
              href={c.href}
              data-keep-filters={c.filters ? "" : undefined}
              data-keep-sandbox={c.filters ? undefined : ""}
              data-explore={c.href}
              className="group flex h-full flex-col rounded-[18px] border border-line bg-surface p-5 shadow-card transition-colors hover:border-accent/50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {c.index && (
                  <span
                    className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent"
                    title={`Point ${c.index} du sujet`}
                  >
                    {c.index}
                  </span>
                )}
                {c.title}
              </span>
              <span className="mt-3 text-3xl font-bold">{c.figure}</span>
              <span className="mt-1 text-sm leading-relaxed text-ink-2">{c.caption}</span>
              <span className="mt-auto pt-3 text-sm font-semibold text-accent group-hover:underline">
                Ouvrir →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
