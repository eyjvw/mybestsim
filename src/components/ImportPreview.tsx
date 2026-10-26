import { useCallback, useEffect, useState } from "react";
import type { Audit } from "../lib/audit";
import { formatEur, formatInt, formatPct, formatTier } from "../lib/format";
import { type ImportPreview as Preview, previewImport } from "../lib/import-preview";
import { loadCatalog } from "../lib/runtime";
import { SAMPLE_CHANGES } from "../lib/sample";
import type { Product } from "../lib/types";
import { Panel } from "./Section";

interface Props {
  sampleUrl: string;
  /** Same sample without the invalid rows: it can be published. */
  validSampleUrl: string;
}

interface PublishResult {
  status: "published" | "unchanged" | "rejected" | "held" | "preview";
  importId: string | null;
  reasons: string[];
  error?: string;
}

type Upload = { file: string; text: string };

/**
 * Sends the previewed files to the ingest service. The token stays in memory: it is never
 * written to storage, and it is only needed to publish, not to preview.
 */
function PublishPanel({
  uploads,
  preview,
  live,
  onPublished,
}: {
  uploads: Upload[];
  preview: Preview;
  live: boolean;
  onPublished: () => void;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const invalid = preview.quality.rejected.length > 0;
  const held = !preview.guard.ok;

  const publish = async () => {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      for (const u of uploads)
        form.append("file", new File([u.text], u.file, { type: "text/csv" }));
      const res = await fetch(`/api/imports${force ? "?force=1" : ""}`, {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as Partial<PublishResult> & {
        error?: string;
      };
      setResult({
        status: (body.status as PublishResult["status"]) ?? "rejected",
        importId: body.importId ?? null,
        reasons: body.reasons ?? [],
        error: body.error,
      });
      if (res.status === 201) onPublished();
    } catch {
      setResult({
        status: "rejected",
        importId: null,
        reasons: [],
        error: "Service d'ingestion injoignable.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!live) {
    return (
      <Panel title="Publier">
        <p className="text-sm text-ink-2">
          Cette version du site est statique : le service d'ingestion n'est pas joignable, la
          publication est désactivée. L'aperçu ci-dessus reste exact.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Publier dans le catalogue"
      note="Le service d'ingestion revalide le fichier, applique le garde-fou, publie une nouvelle release des données et notifie l'équipe. Le site n'est pas reconstruit : le tableau de bord lit les nouvelles données immédiatement."
    >
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
        data-publish-form
      >
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Jeton de publication
          </span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm shadow-card"
            name="token"
          />
        </label>
        <button
          type="submit"
          disabled={busy || invalid || !token || (held && !force)}
          className="h-10 rounded-full bg-cta px-5 text-sm font-semibold text-white shadow-card hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Publication…" : "Publier"}
        </button>
      </form>
      {invalid && (
        <p className="mt-2 text-sm text-ink-2">
          Corrigez d'abord les lignes rejetées : un fichier invalide n'est jamais publié.
        </p>
      )}
      {held && (
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--accent)]"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>
            Le garde-fou retient ce fichier (
            {preview.guard.violations.map((v) => v.provider).join(", ")} : variations anormales). Je
            l'ai vérifié, publier quand même.
          </span>
        </label>
      )}
      {result && (
        <div
          role="status"
          className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm"
          data-publish-result={result.status}
        >
          {result.status === "unchanged" ? (
            <p>
              <strong>Rien à publier</strong> : le fichier est identique au catalogue en ligne,
              aucune nouvelle release n'a été créée.
            </p>
          ) : result.status === "published" ? (
            <p>
              <strong>Publié</strong> : release <code>{result.importId}</code>.{" "}
              <a
                className="font-semibold text-accent underline-offset-2 hover:underline"
                href="/#changes"
              >
                Voir le tableau de bord →
              </a>
            </p>
          ) : (
            <>
              <p>
                <strong>
                  {result.status === "held" ? "Retenu par le garde-fou" : "Non publié"}
                </strong>
                {result.error ? ` : ${result.error}` : ""}
              </p>
              {result.reasons.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-ink-2">
                  {result.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

const MAX_BYTES = 5 * 1024 * 1024;
const SHOWN = 8;

const plan = (p: Product) => `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;
const signed = (n: number) => `${n > 0 ? "+" : "−"}${formatEur(Math.abs(n))}`;

function Figure({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-2.5">
      <dd className="flex items-center gap-1.5 text-xl font-semibold">
        {tone === "warn" && value > 0 && (
          <span aria-hidden="true" className="text-sm">
            ⚠
          </span>
        )}
        {formatInt(value)}
      </dd>
      <dt className="text-xs text-ink-3">{label}</dt>
    </div>
  );
}

function AuditList({ audit }: { audit: Audit }) {
  const rows = [
    ...audit.outliers.slice(0, SHOWN).map((o) => ({
      key: `o-${o.product.sku}`,
      kind: "Prix atypique",
      text: `${o.product.sku} · ${plan(o.product)} à ${formatEur(o.product.price)}, médiane ${formatEur(o.median)}`,
    })),
    ...audit.duplicates.slice(0, SHOWN).map((d) => ({
      key: `d-${d.skus.join()}`,
      kind: "Doublon",
      text: `${d.skus.join(" = ")} · ${plan(d.sample)}, ${formatEur(d.min)} → ${formatEur(d.max)}`,
    })),
  ];
  const hidden = audit.outliers.length + audit.duplicates.length - rows.length;
  if (rows.length === 0)
    return <p className="text-sm text-ink-2">Aucun prix atypique ni doublon dans ce fichier.</p>;
  return (
    <ul className="divide-y divide-line/70 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="py-1.5">
          <span className="mr-2 rounded bg-warn px-1 py-0.5 text-[11px] font-semibold text-[#0b0b0b]">
            {r.kind}
          </span>
          <span className="text-ink-2">{r.text}</span>
        </li>
      ))}
      {hidden > 0 && (
        <li className="py-1.5 text-ink-3">
          … et {formatInt(hidden)} autre{hidden > 1 ? "s" : ""} (rapport complet dans la PR de
          données).
        </li>
      )}
    </ul>
  );
}

/**
 * Drop tomorrow's supplier file and see what the import would do, before it reaches the
 * catalog: the preview runs in the browser with the build's own validator, then the file
 * can be published to the ingest service.
 */
export default function ImportPreview({ sampleUrl, validSampleUrl }: Props) {
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [live, setLive] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const refresh = useCallback(() => {
    loadCatalog()
      .then((c) => {
        setCatalog(c.products);
        setLive(c.source === "live");
      })
      .catch(() => setError("Le catalogue actuel n'a pas pu être chargé."));
  }, []);
  useEffect(() => refresh(), [refresh]);

  const run = useCallback(
    (files: { file: string; text: string }[]) => {
      if (!catalog) return;
      setError(null);
      setNames(files.map((f) => f.file));
      setUploads(files);
      setPreview(previewImport(files, catalog));
    },
    [catalog],
  );

  const readFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (files.length === 0) {
      setError("Déposez un ou plusieurs fichiers .csv.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} dépasse 5 Mo.`);
      return;
    }
    run(await Promise.all(files.map(async (f) => ({ file: f.name, text: await f.text() }))));
  };

  const loadSample = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) {
      setError("L'exemple n'a pas pu être chargé.");
      return;
    }
    run([{ file: "airalo.csv", text: await r.text() }]);
  };

  const d = preview?.diff;
  const ready = catalog !== null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed p-6 text-center shadow-card transition-colors ${dragging ? "border-accent bg-accent-tint" : "border-accent/35 bg-surface hover:bg-accent-tint"}`}
        >
          <span className="text-base font-semibold">Déposez un fichier fournisseur (.csv)</span>
          <span className="text-sm text-ink-2">
            ou cliquez pour le choisir. Il est analysé dans votre navigateur, rien n'est envoyé.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            disabled={!ready}
            data-import-input
            onChange={(e) => void readFiles(e.target.files)}
          />
        </label>
        <Panel title="Pas de fichier sous la main ?">
          <p className="text-sm text-ink-2">
            L'exemple simule le fichier Airalo du lendemain : {SAMPLE_CHANGES.repriced} prix
            modifiés, {SAMPLE_CHANGES.removed} offres retirées, {SAMPLE_CHANGES.added} nouvelles et{" "}
            {SAMPLE_CHANGES.invalid} lignes invalides.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadSample(sampleUrl)}
              disabled={!ready}
              className="rounded-full bg-cta px-5 py-2 text-sm font-semibold text-white shadow-card hover:brightness-110 disabled:opacity-50"
            >
              Analyser l'exemple
            </button>
            <button
              type="button"
              onClick={() => void loadSample(validSampleUrl)}
              disabled={!ready}
              className="rounded-full border border-accent/30 bg-surface px-4 py-2 text-sm font-semibold text-accent hover:border-accent disabled:opacity-50"
            >
              Exemple sans erreur
            </button>
            <a
              className="text-sm font-medium text-accent underline-offset-2 hover:underline"
              href={sampleUrl}
              download="airalo.csv"
            >
              Télécharger l'exemple
            </a>
          </div>
        </Panel>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-cta/30 bg-cta/5 px-4 py-2.5 text-sm">
          {error}
        </p>
      )}
      {!ready && !error && <p className="text-sm text-ink-3">Chargement du catalogue actuel…</p>}

      {preview && d && (
        <div className="space-y-4" data-import-result aria-live="polite">
          <p className="text-sm text-ink-2">
            <strong className="text-ink">{names.join(", ")}</strong> :{" "}
            {formatInt(preview.quality.rows)} lignes,{" "}
            {preview.providers.length > 0
              ? `fournisseur ${preview.providers.join(", ")}`
              : "aucun fournisseur reconnu"}
            .
          </p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Figure label="lignes valides" value={preview.quality.valid} />
            <Figure label="lignes rejetées" value={preview.quality.rejected.length} tone="warn" />
            <Figure label="nouvelles offres" value={d.added.length} />
            <Figure label="offres retirées" value={d.removed.length} />
            <Figure label="prix modifiés" value={d.repriced.length} />
            <Figure label="fiches modifiées" value={d.modified.length} />
            <Figure
              label="points à vérifier"
              value={preview.audit.outliers.length + preview.audit.duplicates.length}
              tone="warn"
            />
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Lignes rejetées"
              note="Le même validateur tourne au build et en CI : ces lignes bloqueraient le déploiement."
            >
              {preview.quality.rejected.length === 0 ? (
                <p className="text-sm text-ink-2">Aucune : le fichier respecte le schéma.</p>
              ) : (
                <ul className="divide-y divide-line/70 text-sm" data-import-rejected>
                  {preview.quality.rejected.map((r) => (
                    <li key={`${r.file}:${r.line}:${r.reason}`} className="py-1.5">
                      <code className="text-ink-2">
                        {r.file}:{r.line}
                      </code>{" "}
                      {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Variations de prix"
              note="Rapprochées par SKU avec le catalogue en ligne."
            >
              {d.repriced.length === 0 ? (
                <p className="text-sm text-ink-2">Aucun prix modifié.</p>
              ) : (
                <ol className="divide-y divide-line/70" data-import-repriced>
                  {d.repriced.slice(0, SHOWN).map((c) => (
                    <li
                      key={c.after.sku}
                      className="grid gap-x-3 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <span className="truncate">
                        {plan(c.after)} <span className="text-xs text-ink-3">{c.after.sku}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums sm:text-right">
                        {formatEur(c.before.price)} → <strong>{formatEur(c.after.price)}</strong>{" "}
                        <span className="text-xs text-ink-3">
                          {signed(c.delta)} ({c.pct > 0 ? "+" : "−"}
                          {formatPct(Math.abs(c.pct))})
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Offres ajoutées et retirées">
              {d.added.length + d.removed.length === 0 ? (
                <p className="text-sm text-ink-2">Aucune.</p>
              ) : (
                <ul className="divide-y divide-line/70 text-sm">
                  {d.added.slice(0, SHOWN).map((p) => (
                    <li key={`a-${p.sku}`} className="py-1.5">
                      <span className="mr-2 font-semibold text-ink">+</span>
                      {plan(p)} à {formatEur(p.price)}{" "}
                      <span className="text-xs text-ink-3">{p.sku}</span>
                    </li>
                  ))}
                  {d.removed.slice(0, SHOWN).map((p) => (
                    <li key={`r-${p.sku}`} className="py-1.5 text-ink-2">
                      <span className="mr-2 font-semibold">−</span>
                      {plan(p)} à {formatEur(p.price)}{" "}
                      <span className="text-xs text-ink-3">{p.sku}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Points à vérifier"
              note="Prix à 25 % ou plus du prix médian du même forfait sur tout le catalogue, et doublons du fichier."
            >
              <AuditList audit={preview.audit} />
            </Panel>
          </div>
          {preview.stats.total > 0 && (
            <p className="text-sm text-ink-2">
              Ce fichier seul : {formatInt(preview.stats.total)} offres, de{" "}
              {formatEur(preview.stats.price.min)} à {formatEur(preview.stats.price.max)}, prix
              moyen {formatEur(preview.stats.price.avg)}.
            </p>
          )}
          <PublishPanel
            key={names.join()}
            uploads={uploads}
            preview={preview}
            live={live}
            onPublished={refresh}
          />
        </div>
      )}
    </div>
  );
}
