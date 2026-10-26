// README: links and images resolve, anchors match headings, and every figure it states equals a
// value measured now (raw CSV recomputation, built stats, test runners). Run after `bun run build`.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { group, median, readDir } from "./lib/raw.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
if (!existsSync("README.md")) fail("README.md missing");
const md = readFileSync("README.md", "utf8");
const text = md.replace(/[  ]/g, " ");

// GitHub heading slugs: lowercase, keep letters (accents too), digits, spaces and hyphens.
const slug = (h) =>
  h
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/ /g, "-");
const anchors = new Set([...md.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1].trim())));
const links = [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
for (const l of links) {
  if (/^https?:/.test(l)) continue;
  if (l.startsWith("#")) {
    if (!anchors.has(l.slice(1))) fail(`broken anchor ${l}`);
  } else if (!existsSync(l)) fail(`broken link ${l}`);
}
const images = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
if (images.length < 6) fail(`expected the screenshots, found ${images.length} images`);

const fr = (n, d = 0) =>
  n
    .toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })
    .replace(/[  ]/g, " ");
const must = (label, s) => {
  if (!text.includes(s)) fail(`${label}: README does not state "${s}"`);
};

// Figures recomputed from the raw CSV files.
const rows = readDir("data");
const prices = rows.map((r) => r.price);
const finite = rows.filter((r) => Number.isFinite(r.gb)).map((r) => r.gb);
const byProvider = [...group(rows, (r) => r.provider)]
  .map(([p, l]) => [p, l.length])
  .sort((a, b) => b[1] - a[1]);
must("total", `| 1. Nombre total de cartes eSIM | ${fr(rows.length)} |`);
must("over 100", `| ${fr(prices.filter((p) => p > 100).length)} |`);
must("range", `${fr(Math.min(...prices), 2)} € à ${fr(Math.max(...prices), 2)} €`);
must(
  "avg data",
  `${fr(finite.reduce((a, b) => a + b, 0) / finite.length, 2)} Go (hors ${fr(rows.length - finite.length)} offres illimitées)`,
);
must(
  "avg price",
  `${fr(prices.reduce((a, b) => a + b, 0) / prices.length, 2)} € (médiane ${fr(median(prices), 2)} €)`,
);
must(
  "providers",
  `${byProvider.length} fournisseurs, d'${byProvider[0][0]} (${byProvider[0][1]}) à ${byProvider.at(-1)[0]} (${byProvider.at(-1)[1]})`,
);

// Figures from the built stats (themselves checked against raw CSV by the v2 business oracle).
const stats = JSON.parse(readFileSync("dist/stats.json", "utf8"));
const m = stats.market;
must("plans", `Sur ${fr(m.plans)} forfaits`);
must("comparable", `${fr(m.comparable)} sont vendus par au moins deux fournisseurs`);
must("gap", `${fr(m.biggestGaps[0].max - m.biggestGaps[0].min, 2)} €`);
must("efficient", `Seules ${fr(m.efficient.count)} offres sur ${fr(stats.total)}`);
must("duplicates", `${fr(stats.audit.duplicates.groups)} produits identiques`);
must("outliers", `${fr(stats.audit.outliers.length)} prix atypiques`);
must("dominated", `${fr(stats.audit.dominatedWithinProvider)} offres incohérentes`);
must("5G plans", `sur ${fr(m.networkPremium.plans)} forfaits vendus dans les deux réseaux`);
must("5G ratio", `${fr(m.networkPremium.medianRatio * 100, 1)} % du prix 4G`);

// Test and tooling counts, measured by running the tools.
const unit = spawnSync("bun", ["test"], { encoding: "utf8" });
const u = `${unit.stdout}${unit.stderr}`.match(/Ran (\d+) tests across (\d+) files/);
if (!u) fail("bun test did not report its counts");
must("unit tests", `${u[1]} tests dans ${u[2]} fichiers`);
const list = spawnSync("bunx", ["playwright", "test", "--list"], { encoding: "utf8" }).stdout;
const e = list.match(/Total: (\d+) tests in (\d+) files/);
if (!e) fail("playwright --list did not report its counts");
must("e2e tests", `${e[1]} tests dans ${e[2]} fichiers`);
const oracles = readdirSync("checks").filter((f) => /^verify-[^/]+\.(mjs|ts)$/.test(f));
must("oracles", `${oracles.length} scripts dans \`checks/\``);
// The CI list of checks/run.mjs, counted from its source (running it would run them all).
const ciList = readFileSync("checks/run.mjs", "utf8").match(/const CI = \[([\s\S]*?)\n\];/)?.[1];
if (!ciList) fail("checks/run.mjs: CI list not found");
const ciCount = (ciList.match(/^\s+\["verify-/gm) ?? []).length;
must("ci oracles", `la CI en lance ${ciCount} à chaque PR`);

console.log(
  `${links.length} links and ${images.length} images resolve; ${anchors.size} headings; figures, ${u[1]} unit and ${e[1]} e2e tests, ${oracles.length} oracles match`,
);
console.log("README OK");
