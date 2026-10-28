import type { ChangesSummary } from "../lib/changes";
import { formatEur, formatInt, formatPct } from "../lib/format";
import { Panel } from "./Section";

interface Props {
  changes: ChangesSummary;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

function Count({ label, value, sign }: { label: string; value: number; sign?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-2.5">
      <dd className="text-xl font-bold">
        {sign && value > 0 ? sign : ""}
        {formatInt(value)}
      </dd>
      <dt className="text-xs text-ink-3">{label}</dt>
    </div>
  );
}

/** "Depuis le dernier import": what the last published file changed, from /data/changes.json. */
export function Changes({ changes: c }: Props) {
  const total = c.added + c.removed + c.up + c.down + c.modified;
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]" data-changes={c.importId}>
      <Panel
        title={`Import du ${when(c.importedAt)}`}
        note={`Import ${c.importId}, comparé au précédent (${c.previousImportId}).`}
      >
        {total === 0 ? (
          <p className="text-sm text-ink-2">Aucun changement par rapport à l'import précédent.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <Count label="nouvelles offres" value={c.added} sign="+" />
              <Count label="offres retirées" value={c.removed} sign="−" />
              <Count label="hausses de prix" value={c.up} />
              <Count label="baisses de prix" value={c.down} />
              <Count label="fiches modifiées" value={c.modified} />
            </dl>
            {c.byProvider.length > 0 && (
              <p className="mt-3 text-sm text-ink-2">
                Fournisseur{c.byProvider.length > 1 ? "s" : ""} concerné
                {c.byProvider.length > 1 ? "s" : ""} :{" "}
                {c.byProvider.map((p) => p.provider).join(", ")}.
              </p>
            )}
          </>
        )}
      </Panel>
      <Panel title="Plus fortes variations de prix">
        {c.topMoves.length === 0 ? (
          <p className="text-sm text-ink-2">Aucun prix modifié.</p>
        ) : (
          <ol className="divide-y divide-line/70" data-change-moves>
            {c.topMoves.map((m) => (
              <li
                key={m.sku}
                className="grid gap-x-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{m.provider}</span> · {m.label}
                </span>
                <span className="whitespace-nowrap tabular-nums sm:text-right">
                  {formatEur(m.before)} → <strong>{formatEur(m.price)}</strong>{" "}
                  <span className="text-xs text-ink-3">
                    ({m.pct > 0 ? "+" : "−"}
                    {formatPct(Math.abs(m.pct))})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {(c.addedSample.length > 0 || c.removedSample.length > 0) && (
          <ul className="mt-3 space-y-1 border-t border-line/70 pt-3 text-sm">
            {c.addedSample.map((o) => (
              <li key={`a-${o.sku}`}>
                <span className="mr-1.5 font-semibold text-accent">+</span>
                {o.provider} · {o.label} à {formatEur(o.price)}
              </li>
            ))}
            {c.removedSample.map((o) => (
              <li key={`r-${o.sku}`} className="text-ink-2">
                <span className="mr-1.5 font-semibold">−</span>
                {o.provider} · {o.label} à {formatEur(o.price)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
