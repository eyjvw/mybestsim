// Compares two data directories and prints a Markdown import report (CI posts it on data PRs).
// Usage: bun scripts/data-report.ts --base <dir> --head <dir> [--out report.md] [--json]
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { auditCatalog } from "../src/lib/audit";
import { diffCatalogs } from "../src/lib/diff";
import { checkGuard } from "../src/lib/guard";
import { loadCatalog } from "../src/lib/load";
import { renderDataReport } from "../src/lib/report";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string", default: "data" },
    out: { type: "string" },
    json: { type: "boolean", default: false },
  },
});
if (!values.base) {
  console.error(
    "usage: bun scripts/data-report.ts --base <dir> --head <dir> [--out file] [--json]",
  );
  process.exit(2);
}

const base = loadCatalog(values.base);
const head = loadCatalog(values.head);
const diff = diffCatalogs(base.products, head.products);
const audit = auditCatalog(head.products);
const guard = checkGuard(diff, base.products);

if (values.json) {
  const skus = (ps: { sku: string }[]) => ps.map((p) => p.sku).sort();
  console.log(
    JSON.stringify({
      rejected: head.quality.rejected.length,
      added: skus(diff.added),
      removed: skus(diff.removed),
      repriced: diff.repriced.map((c) => ({
        sku: c.after.sku,
        before: c.before.price,
        after: c.after.price,
      })),
      modified: skus(diff.modified.map((c) => c.after)),
      outliers: audit.outliers.length,
      duplicates: audit.duplicates.length,
      dominated: audit.dominated.length,
      guard,
    }),
  );
} else {
  const report = renderDataReport({
    quality: head.quality,
    diff,
    audit,
    baseTotal: base.products.length,
    headTotal: head.products.length,
    guard,
  });
  if (values.out) writeFileSync(values.out, report);
  else process.stdout.write(report);
}
