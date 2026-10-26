// Imports supplier CSVs straight into a data volume, e.g. `docker exec` on the VPS or a cron.
// Usage: bun run import [--data-dir DIR] [--dry-run] [--force] <file.csv | directory>...
// Same pipeline as the API and the inbox; the volume lock keeps it safe next to the server.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { DataStore } from "../server/store";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "data-dir": { type: "string", default: process.env.DATA_DIR ?? "/data" },
    "seed-dir": { type: "string", default: process.env.SEED_DIR ?? "data" },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});
if (positionals.length === 0) {
  console.error(
    "Usage : bun run import [--data-dir DIR] [--dry-run] [--force] <fichier.csv | dossier>...",
  );
  process.exit(2);
}

const files = positionals.flatMap((t) =>
  statSync(t).isDirectory()
    ? readdirSync(t)
        .filter((f) => f.toLowerCase().endsWith(".csv"))
        .sort()
        .map((f) => join(t, f))
    : [t],
);
const store = new DataStore(values["data-dir"] as string, { seedDir: values["seed-dir"] });
store.init();
const outcome = await store.import(
  files.map((f) => ({ file: basename(f), text: readFileSync(f, "utf8") })),
  { source: "inbox", dryRun: values["dry-run"], force: values.force },
);

const label = {
  published: "publié",
  unchanged: "inchangé",
  preview: "aperçu (rien n'est écrit)",
  rejected: "refusé",
  held: "retenu par le garde-fou",
}[outcome.status];
const s = outcome.summary;
console.log(
  `${outcome.status === "published" || outcome.status === "preview" || outcome.status === "unchanged" ? "✓" : "✗"} ${files.map((f) => basename(f)).join(", ")} · ${outcome.providers.join(", ") || "?"} · ${label}${outcome.importId ? ` · release ${outcome.importId}` : ""}`,
);
console.log(
  `  +${s.added} −${s.removed} · ${s.up} hausses · ${s.down} baisses · ${s.modified} fiches modifiées`,
);
for (const r of outcome.reasons) console.log(`  ${r}`);
for (const r of outcome.rejected.slice(0, 10)) console.log(`  ${r.file}:${r.line} ${r.reason}`);
if (outcome.rejected.length > 10) console.log(`  et ${outcome.rejected.length - 10} autres lignes`);
process.exit(outcome.status === "rejected" || outcome.status === "held" ? 1 : 0);
