import { auditCatalog } from "./audit";
import { mergeCatalog } from "./catalog";
import { type ChangesSummary, summarizeChanges } from "./changes";
import { type CatalogDiff, diffCatalogs } from "./diff";
import { checkGuard, DEFAULT_GUARD, type GuardConfig, type GuardResult } from "./guard";
import { statsPayload } from "./payload";
import { renderDataReport } from "./report";
import type { Product, QualityReport } from "./types";

/**
 * Pure core of an import: given today's supplier files and the uploaded ones, decide what
 * would be published. No I/O, so the build, the CLI, the server and the tests share it.
 */
export interface SupplierFile {
  file: string;
  text: string;
}

export interface ReleaseMeta {
  importId: string;
  importedAt: string;
  previousImportId: string | null;
  source: "seed" | "api" | "inbox";
}

export type ImportStatus = "published" | "rejected" | "held";

export interface ImportPlan {
  status: ImportStatus;
  /** Why the import is not published, in French, for the API response and the UI. */
  reasons: string[];
  /** Quality of the uploaded files alone. */
  quality: QualityReport;
  providers: string[];
  diff: CatalogDiff;
  guard: GuardResult;
  /** The full set of supplier files after the import (only meaningful when published). */
  files: SupplierFile[];
  products: Product[];
  report: string;
}

/** Keeps a safe, predictable file name: basename, lowercase, [a-z0-9._-], .csv. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/\.csv$/, "");
  const stem = clean.replace(/^[.-]+/, "").replace(/-+$/, "") || "import";
  return `${stem}.csv`;
}

export function planImport(
  current: SupplierFile[],
  uploaded: SupplierFile[],
  options: { force?: boolean; guard?: GuardConfig } = {},
): ImportPlan {
  const incoming = uploaded.map((f) => ({ file: safeFileName(f.file), text: f.text }));
  const imported = mergeCatalog(incoming);
  const providers = [...new Set(imported.products.map((p) => p.provider))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const currentCatalog = mergeCatalog(current);
  const reasons: string[] = [];

  if (incoming.length === 0) reasons.push("Aucun fichier CSV reçu.");
  if (imported.quality.rejected.length > 0) {
    reasons.push(
      `${imported.quality.rejected.length} ligne(s) rejetée(s) par le validateur : le fichier est refusé en entier.`,
    );
  }
  if (incoming.length > 0 && providers.length === 0 && imported.quality.rejected.length === 0) {
    reasons.push("Le fichier ne contient aucune offre.");
  }

  // Each uploaded provider replaces its current file; a new provider gets a new file.
  const providerOf = (f: SupplierFile) => mergeCatalog([f]).products[0]?.provider;
  const currentProvider = new Map(current.map((f) => [f.file, providerOf(f)]));
  const fileOf = new Map([...currentProvider].map(([file, p]) => [p, file]));
  const replaced = new Set(providers);
  const kept = current.filter((f) => {
    const p = currentProvider.get(f.file);
    return !p || !replaced.has(p);
  });
  const taken = new Set(kept.map((f) => f.file));
  const placed = incoming.map((f) => {
    const p = providerOf(f);
    let name = (p && fileOf.get(p)) || f.file;
    if (taken.has(name)) name = safeFileName(p ?? name);
    for (let i = 2; taken.has(name); i++) name = name.replace(/(-\d+)?\.csv$/, `-${i}.csv`);
    taken.add(name);
    return { file: name, text: f.text };
  });
  const files = [...kept, ...placed].sort((a, b) => a.file.localeCompare(b.file));
  const next = mergeCatalog(files);
  if (reasons.length === 0 && next.quality.rejected.length > 0) {
    reasons.push(`Conflit avec le catalogue : ${next.quality.rejected[0].reason}.`);
  }

  const diff = diffCatalogs(currentCatalog.products, next.products);
  const guard = checkGuard(diff, currentCatalog.products, options.guard ?? DEFAULT_GUARD);
  const blocked = reasons.length > 0;
  const held = !blocked && !guard.ok && !options.force;
  if (held) {
    for (const v of guard.violations) {
      reasons.push(
        v.kind === "price-moves"
          ? `${v.provider} : ${v.count} prix sur ${v.base} varient de 30 % ou plus. Import retenu pour vérification.`
          : `${v.provider} : ${v.count} offres sur ${v.base} disparaissent. Import retenu pour vérification.`,
      );
    }
  }
  const status: ImportStatus = blocked ? "rejected" : held ? "held" : "published";
  const report = renderDataReport({
    quality: imported.quality,
    diff,
    audit: auditCatalog(next.products),
    baseTotal: currentCatalog.products.length,
    headTotal: next.products.length,
    guard,
  });
  return {
    status,
    reasons,
    quality: imported.quality,
    providers,
    diff,
    guard,
    files,
    products: next.products,
    report,
  };
}

/** The JSON files served under /data for one release. */
export function releaseArtifacts(
  plan: Pick<ImportPlan, "files" | "products" | "diff">,
  meta: ReleaseMeta,
) {
  const quality = mergeCatalog(plan.files).quality;
  const changes: ChangesSummary | null = meta.previousImportId
    ? summarizeChanges(plan.diff, {
        importId: meta.importId,
        importedAt: meta.importedAt,
        previousImportId: meta.previousImportId,
      })
    : null;
  return {
    "catalog.json": {
      generatedAt: meta.importedAt,
      importId: meta.importId,
      products: plan.products,
    },
    "stats.json": statsPayload(plan.products, quality, meta.importedAt),
    "changes.json": changes,
    "version.json": {
      importId: meta.importId,
      importedAt: meta.importedAt,
      previousImportId: meta.previousImportId,
      source: meta.source,
      files: plan.files.map((f) => f.file),
      quality,
    },
  };
}
