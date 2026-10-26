import type { Audit } from "./audit";
import type { CatalogDiff } from "./diff";
import { formatEur, formatInt, formatPct, formatTier } from "./format";
import type { GuardResult } from "./guard";
import type { Product, QualityReport } from "./types";

/** Hidden marker so CI updates its previous comment instead of piling up new ones. */
export const REPORT_MARKER = "<!-- mybestsim-data-report -->";

export interface ReportInput {
  quality: QualityReport;
  diff: CatalogDiff;
  audit: Audit;
  baseTotal: number;
  headTotal: number;
  /** Row cap for each detail table. */
  limit?: number;
  /** Price-move guard result, reported when given. */
  guard?: GuardResult;
}

const offer = (p: Product) =>
  `${p.provider} · ${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatEur(Math.abs(n))}`;
const signedPct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatPct(Math.abs(n))}`;
const md = (s: string) => s.replace(/\|/g, "\\|");
const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n > 1 ? many : one}`;

/** Markdown review of a data import: schema, changes, then anomalies. */
export function renderDataReport(input: ReportInput): string {
  const { quality, diff, audit, baseTotal, headTotal, limit = 10, guard } = input;
  const rejected = quality.rejected.length;
  const up = diff.repriced.filter((c) => c.delta > 0).length;
  const down = diff.repriced.length - up;
  const lines: string[] = [REPORT_MARKER, "## Rapport d'import des données", ""];

  lines.push(
    rejected === 0
      ? `✅ **Schéma valide** : ${plural(quality.rows, "ligne lue", "lignes lues")} dans ${plural(quality.files, "fichier", "fichiers")}, 0 rejet.`
      : `❌ **${plural(rejected, "ligne rejetée", "lignes rejetées")}** sur ${formatInt(quality.rows)} : le déploiement est bloqué tant que ce n'est pas corrigé.`,
    "",
    "| Catalogue | Avant | Après | Ajoutées | Retirées | Prix en hausse | Prix en baisse | Fiches modifiées |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| Offres | ${formatInt(baseTotal)} | ${formatInt(headTotal)} | ${formatInt(diff.added.length)} | ${formatInt(diff.removed.length)} | ${formatInt(up)} | ${formatInt(down)} | ${formatInt(diff.modified.length)} |`,
    "",
  );

  if (rejected > 0) {
    lines.push("### Lignes rejetées", "", "| Fichier | Ligne | Raison |", "| --- | ---: | --- |");
    for (const r of quality.rejected.slice(0, limit)) {
      lines.push(`| \`${md(r.file)}\` | ${r.line} | ${md(r.reason)} |`);
    }
    if (rejected > limit) lines.push(`| … | | ${formatInt(rejected - limit)} autres |`);
    lines.push("");
  }

  if (guard && !guard.ok) {
    lines.push(
      "### ⚠️ Garde-fou : import retenu",
      "",
      "Variations anormales pour un import quotidien (export fournisseur probablement cassé) :",
      "",
      ...guard.violations.map((v) =>
        v.kind === "price-moves"
          ? `- **${md(v.provider)}** : ${formatInt(v.count)} prix sur ${formatInt(v.base)} (${formatPct(v.share)}) varient de 30 % ou plus`
          : `- **${md(v.provider)}** : ${formatInt(v.count)} offres sur ${formatInt(v.base)} (${formatPct(v.share)}) disparaissent`,
      ),
      "",
    );
  }

  if (diff.byProvider.length > 0) {
    lines.push(
      "### Par fournisseur",
      "",
      "| Fournisseur | Ajoutées | Retirées | Hausses | Baisses | Modifiées |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
      ...diff.byProvider.map(
        (p) =>
          `| ${md(p.provider)} | ${p.added} | ${p.removed} | ${p.up} | ${p.down} | ${p.modified} |`,
      ),
      "",
    );
  }

  if (diff.repriced.length > 0) {
    lines.push(
      "### Plus fortes variations de prix",
      "",
      "| Offre | SKU | Avant | Après | Variation |",
      "| --- | --- | ---: | ---: | ---: |",
      ...diff.repriced
        .slice(0, limit)
        .map(
          (c) =>
            `| ${md(offer(c.after))} | \`${c.after.sku}\` | ${formatEur(c.before.price)} | ${formatEur(c.after.price)} | ${signed(c.delta)} (${signedPct(c.pct)}) |`,
        ),
      "",
    );
  }

  const anomalies = audit.outliers.length + audit.duplicates.length + audit.dominated.length;
  lines.push(
    "### Points à vérifier",
    "",
    anomalies === 0
      ? "Aucune anomalie détectée."
      : [
          `- **${plural(audit.outliers.length, "prix atypique", "prix atypiques")}** (écart de 25 % ou plus avec le prix médian du même forfait)`,
          `- **${plural(audit.duplicates.length, "doublon", "doublons")}** (même fournisseur, même forfait, plusieurs SKU)`,
          `- **${plural(audit.dominated.length, "offre dominée", "offres dominées")}** dans la gamme de leur propre fournisseur`,
        ].join("\n"),
    "",
  );
  if (audit.outliers.length > 0) {
    lines.push(
      "| Offre | SKU | Prix | Médiane du forfait | Écart |",
      "| --- | --- | ---: | ---: | ---: |",
      ...audit.outliers
        .slice(0, limit)
        .map(
          (o) =>
            `| ${md(offer(o.product))} | \`${o.product.sku}\` | ${formatEur(o.product.price)} | ${formatEur(o.median)} | ${signedPct(o.deviation)} |`,
        ),
      "",
    );
  }
  lines.push("<sub>Généré par `scripts/data-report.ts` à chaque PR qui touche `data/`.</sub>");
  return `${lines.join("\n")}\n`;
}
