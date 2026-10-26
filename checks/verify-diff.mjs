// The data report CLI must report exactly what an independent SKU diff of the raw CSVs finds.
// Base = data/, head = data/ with airalo.csv replaced by the built sample. Run after build.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDir } from "./lib/raw.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const dir = mkdtempSync(join(tmpdir(), "mbs-diff-"));
try {
  const head = join(dir, "head");
  cpSync("data", head, { recursive: true });
  copyFileSync("dist/exemple-import.csv", join(head, "airalo.csv"));

  const base = readDir("data");
  const next = readDir(head);
  const valid = next.filter((r) => r.valid);
  const before = new Map(base.map((r) => [r.sku, r]));
  const after = new Map(valid.map((r) => [r.sku, r]));
  const expected = {
    rejected: next.length - valid.length,
    added: valid
      .filter((r) => !before.has(r.sku))
      .map((r) => r.sku)
      .sort(),
    removed: base
      .filter((r) => !after.has(r.sku))
      .map((r) => r.sku)
      .sort(),
    repriced: valid
      .filter((r) => before.has(r.sku) && before.get(r.sku).price !== r.price)
      .map((r) => r.sku)
      .sort(),
  };
  if (
    expected.added.length === 0 ||
    expected.removed.length === 0 ||
    expected.repriced.length === 0 ||
    expected.rejected === 0
  )
    fail(`sample does not exercise every case: ${JSON.stringify(expected)}`);

  const json = spawnSync(
    "bun",
    ["scripts/data-report.ts", "--base", "data", "--head", head, "--json"],
    { encoding: "utf8" },
  );
  if (json.status !== 0) fail(`data-report --json: ${json.stderr}`);
  const got = JSON.parse(json.stdout);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (got.rejected !== expected.rejected) fail(`rejected ${got.rejected} != ${expected.rejected}`);
  if (!same(got.added, expected.added)) fail(`added ${got.added} != ${expected.added}`);
  if (!same(got.removed, expected.removed)) fail(`removed ${got.removed} != ${expected.removed}`);
  if (!same(got.repriced.map((c) => c.sku).sort(), expected.repriced)) fail("repriced set differs");
  for (const c of got.repriced) {
    if (before.get(c.sku).price !== c.before || after.get(c.sku).price !== c.after)
      fail(`price of ${c.sku}`);
  }

  const md = spawnSync("bun", ["scripts/data-report.ts", "--base", "data", "--head", head], {
    encoding: "utf8",
  }).stdout;
  const row = `| Offres | ${base.length.toLocaleString("fr-FR")} | ${valid.length.toLocaleString("fr-FR")} | ${expected.added.length} | ${expected.removed.length} |`;
  if (!md.startsWith("<!-- mybestsim-data-report -->")) fail("markdown marker missing");
  if (!md.replace(/[  ]/g, " ").includes(row.replace(/[  ]/g, " ")))
    fail(`summary row missing: ${row}`);
  if (!md.includes(`${expected.rejected} lignes rejetées`)) fail("rejections not reported");

  const same0 = spawnSync(
    "bun",
    ["scripts/data-report.ts", "--base", "data", "--head", "data", "--json"],
    { encoding: "utf8" },
  );
  const zero = JSON.parse(same0.stdout);
  if (zero.added.length + zero.removed.length + zero.repriced.length + zero.modified.length !== 0)
    fail("identical dirs report changes");

  console.log(
    `added ${expected.added.length}, removed ${expected.removed.length}, repriced ${expected.repriced.length}, rejected ${expected.rejected}; identical dirs: no change`,
  );
  console.log("DIFF ORACLE PASSED");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
