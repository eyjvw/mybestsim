import { type AuditSummary, OUTLIER_MIN_PEERS, OUTLIER_THRESHOLD } from "../lib/audit";
import { formatEur, formatInt, formatPct, formatTier } from "../lib/format";
import type { Product, QualityReport } from "../lib/types";
import { Section } from "./Section";

interface Props {
  quality: QualityReport;
  audit: AuditSummary;
}

const plan = (p: Product) => `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;
const card = "min-w-0 rounded-[18px] border border-line bg-surface p-4 shadow-card";

/** Schema report of the current files, plus the business checks recomputed on the live catalog. */
export function Quality({ quality, audit }: Props) {
  const maxDup = audit.duplicates.top[0];
  const figures = [
    ["Fichiers lus", quality.files],
    ["Lignes lues", quality.rows],
    ["Lignes valides", quality.valid],
    ["Lignes rejetées", quality.rejected.length],
  ] as const;
  const checks = [
    {
      id: "duplicates",
      count: audit.duplicates.count,
      title: "Doublons chez un même fournisseur",
      rule: "Même fournisseur, même forfait, même réseau et même recharge, sous plusieurs SKU.",
      summary: maxDup
        ? `${formatInt(audit.duplicates.count)} produits apparaissent sous ${formatInt(audit.duplicates.skus)} SKU. Écart de prix jusqu'à ${formatPct(maxDup.ratio - 1)} pour un produit identique : un comparateur ne doit en afficher qu'un.`
        : "Aucun doublon.",
      rows: audit.duplicates.top.map((d) => ({
        label: `${d.provider} · ${plan(d.sample)}`,
        value: `${formatEur(d.min)} → ${formatEur(d.max)}`,
        note: d.skus.join(", "),
      })),
    },
    {
      id: "outliers",
      count: audit.outliers.count,
      title: "Prix atypiques",
      rule: `Écart d'au moins ${formatPct(OUTLIER_THRESHOLD)} avec le prix médian du même forfait, quand ${OUTLIER_MIN_PEERS} offres ou plus le vendent.`,
      summary: audit.outliers.count
        ? `${formatInt(audit.outliers.count)} prix à vérifier avant publication : erreur d'import possible, ou vraie bonne affaire à mettre en avant.`
        : "Aucun prix atypique.",
      rows: audit.outliers.top.map((o) => ({
        label: `${o.product.provider} · ${plan(o.product)}`,
        value: `${formatEur(o.product.price)} (${o.deviation > 0 ? "+" : "−"}${formatPct(Math.abs(o.deviation))})`,
        note: `médiane ${formatEur(o.median)} sur ${o.peers} offres · ${o.product.sku}`,
      })),
    },
    {
      id: "dominated",
      count: audit.dominated.count,
      title: "Offres incohérentes dans la gamme du fournisseur",
      rule: "Le même fournisseur vend, pour la même destination, une offre moins chère avec au moins autant de data, de durée, de réseau et de recharge.",
      summary: audit.dominated.count
        ? `${formatInt(audit.dominated.count)} offres n'ont aucune raison d'être achetées. Grille tarifaire à signaler au fournisseur, ou à masquer côté site.`
        : "Aucune incohérence.",
      rows: audit.dominated.top.map((d) => ({
        label: `${d.offer.provider} · ${d.offer.countryName} : ${formatTier(d.offer.dataGb)} ${d.offer.validityDays} j ${d.offer.network} à ${formatEur(d.offer.price)}`,
        value: `−${formatEur(d.offer.price - d.by.price)}`,
        note: `alors que ${formatTier(d.by.dataGb)} ${d.by.validityDays} j ${d.by.network} coûte ${formatEur(d.by.price)}`,
      })),
    },
  ];

  return (
    <Section
      id="quality"
      title="Contrôle des imports"
      description={
        // One sentence whatever the data source: text that changed once the live data arrived
        // pushed the whole page down (layout shift).
        <>
          Contrôle effectué au build et à chaque import par le service d'ingestion, avec le même
          validateur : un fichier invalide est refusé en entier et n'atteint jamais le catalogue.
          Les contrôles métier ne bloquent pas : ils signalent ce qu'un humain doit regarder.
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <dl className="grid grid-cols-2 gap-3">
          {figures.map(([label, value]) => (
            <div key={label} className={card}>
              <dd className="text-2xl font-bold">{formatInt(value)}</dd>
              <dt className="text-xs text-ink-3">{label}</dt>
            </div>
          ))}
        </dl>
        <div className={card}>
          {quality.rejected.length === 0 ? (
            <p className="text-sm">
              <span className="font-semibold">Aucune ligne rejetée.</span>{" "}
              <span className="text-ink-2">
                Colonnes, types, devise, réseau, cohérence volume/libellé et unicité des SKU sont
                conformes dans les {quality.files} fichiers.
              </span>
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {quality.rejected.map((r) => (
                <li key={`${r.file}:${r.line}:${r.reason}`}>
                  <code className="text-ink-2">
                    {r.file}:{r.line}
                  </code>{" "}
                  {r.reason}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-2">Détail par fichier</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
              {quality.perFile.map((f) => (
                <li key={f.file} className="flex justify-between gap-2 text-xs" title={f.provider}>
                  <code className="truncate text-ink-2">{f.file}</code>
                  <span className="tabular-nums">
                    {formatInt(f.valid)}/{formatInt(f.rows)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <h3 className="mt-8 text-base font-semibold">Contrôles métier : à vérifier par un humain</h3>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {checks.map((c) => (
          <article key={c.id} className={card} data-audit={c.id} data-count={c.count}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {c.count > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warn px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0f172a]">
                  <span aria-hidden="true">⚠</span> À vérifier
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2">
                  ✓ RAS
                </span>
              )}
              {c.title}
            </p>
            <p className="mt-2 text-3xl font-bold">{formatInt(c.count)}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{c.summary}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">Règle : {c.rule}</p>
            {c.rows.length > 0 && (
              <ol className="mt-3 divide-y divide-line/70 border-t border-line/70 text-xs">
                {c.rows.map((r) => (
                  <li
                    key={r.label + r.note}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 py-1.5"
                  >
                    <span className="truncate text-ink" title={r.label}>
                      {r.label}
                    </span>
                    <span className="font-medium whitespace-nowrap tabular-nums">{r.value}</span>
                    <span className="col-span-2 truncate text-ink-3" title={r.note}>
                      {r.note}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}
