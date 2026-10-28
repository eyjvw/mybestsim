import { formatDay, formatEur, formatInt, formatPct } from "../lib/format";
import { MYBESTSIM_CHECKED_ON } from "../lib/mybestsim";
import { type Opportunities as Data, MIN_COMPARABLE_PLANS } from "../lib/opportunities";
import { Panel } from "./Section";

const LOOK = {
  link: "text-xs font-semibold whitespace-nowrap text-accent hover:underline",
  // mybestsim.com's own call to action: red, rounded.
  button:
    "inline-block rounded-full bg-cta px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-card hover:brightness-110",
};

/** A link to the destination's comparison page on mybestsim.com, which opens in a new tab. */
export function MybestsimLink({
  url,
  children,
  look = "link",
}: {
  url: string;
  children: string;
  look?: keyof typeof LOOK;
}) {
  return (
    <a href={url} target="_blank" rel="noopener" className={LOOK[look]} data-mybestsim-link={url}>
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}

/** The business side: the destinations where a comparator helps most, with their mybestsim.com page. */
export function Opportunities({ data }: { data: Data }) {
  return (
    <Panel
      title="Où les prix varient le plus pour un même forfait"
      note={`Écart médian entre l'offre la moins chère et la plus chère d'un même forfait (en euros, puis en part du prix le plus cher), sur les destinations qui ont au moins ${MIN_COMPARABLE_PLANS} forfaits vendus par plusieurs fournisseurs. Ce sont les pages où un comparateur rend le plus service : celles à mettre en avant. Pages mybestsim.com vérifiées le ${formatDay(MYBESTSIM_CHECKED_ON)}.`}
    >
      {data.gaps.length === 0 ? (
        <p className="py-6 text-sm text-ink-3">
          Pas assez de forfaits comparables dans la sélection.
        </p>
      ) : (
        <ol className="grid gap-x-10 lg:grid-flow-col lg:grid-rows-4" data-opportunity-gaps>
          {data.gaps.map((g, i) => (
            <li
              key={g.countryCode}
              data-opportunity={g.countryCode}
              data-gap={g.medianGap.toFixed(2)}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 border-b border-line/70 py-2.5"
            >
              <span className="text-xs font-semibold text-accent tabular-nums">{i + 1}.</span>
              <p className="min-w-0 truncate text-sm font-medium">{g.countryName}</p>
              <p className="text-right text-sm whitespace-nowrap tabular-nums">
                <span className="font-semibold">{formatEur(g.medianGap)}</span>
                <span className="ml-1.5 text-xs text-ink-3">{formatPct(g.medianGapPct)}</span>
              </p>
              <p className="col-start-2 min-w-0 text-xs text-ink-2">
                <span className="whitespace-nowrap">
                  {formatInt(g.comparable)} forfaits comparés
                </span>{" "}
                · <span className="whitespace-nowrap">{formatInt(g.providers)} fournisseurs</span>
              </p>
              <p className="text-right">
                {g.url && <MybestsimLink url={g.url}>Page MyBestSim</MybestsimLink>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
