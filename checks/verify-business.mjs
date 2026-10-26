// Recomputes the comparator and audit figures from raw CSV and checks dist/ against them.
// Run from the repo root after `bun run build`.
import { readFileSync } from "node:fs";
import { group, median, near, readDir } from "./lib/raw.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const rows = readDir("data");
const stats = JSON.parse(readFileSync("dist/stats.json", "utf8"));
// Since v5 the figures are spread over the home page and its sub-pages.
const home = readFileSync("dist/index.html", "utf8");
const html = ["index.html", "analyse/index.html", "offres/index.html", "qualite/index.html"]
  .map((p) => readFileSync(`dist/${p}`, "utf8"))
  .join("\n");
const m = stats.market;

// Plans: destination + data + validity.
const plans = group(rows, (r) => `${r.country_code}|${r.data_gb}|${r.days}`);
const comparable = [...plans.values()].filter((l) => new Set(l.map((r) => r.provider)).size >= 2);
if (m.plans !== plans.size) fail(`plans ${m.plans} != ${plans.size}`);
if (m.comparable !== comparable.length) fail(`comparable ${m.comparable} != ${comparable.length}`);

const saving = median(
  comparable.map((l) => median(l.map((r) => r.price)) - Math.min(...l.map((r) => r.price))),
);
if (!near(m.medianSaving, saving)) fail(`median saving ${m.medianSaving} != ${saving}`);

const gaps = comparable.map(
  (l) => Math.max(...l.map((r) => r.price)) - Math.min(...l.map((r) => r.price)),
);
const maxGap = Math.max(...gaps);
const g0 = m.biggestGaps[0];
if (!near(g0.max - g0.min, maxGap)) fail(`biggest gap ${g0.max - g0.min} != ${maxGap}`);

const wins = new Map();
for (const l of comparable) {
  const min = Math.min(...l.map((r) => r.price));
  for (const p of new Set(l.filter((r) => r.price === min).map((r) => r.provider)))
    wins.set(p, (wins.get(p) ?? 0) + 1);
}
for (const w of m.wins)
  if (wins.get(w.provider) !== w.wins)
    fail(`wins ${w.provider} ${w.wins} != ${wins.get(w.provider)}`);
if (m.wins.length !== wins.size) fail("wins provider set differs");

const ratios = [];
for (const l of plans.values()) {
  const p4 = l.filter((r) => r.network === "4G").map((r) => r.price);
  const p5 = l.filter((r) => r.network === "5G").map((r) => r.price);
  if (p4.length && p5.length) ratios.push(median(p5) / median(p4));
}
if (m.networkPremium.plans !== ratios.length || !near(m.networkPremium.medianRatio, median(ratios)))
  fail(`5G premium ${JSON.stringify(m.networkPremium)} != ${ratios.length}/${median(ratios)}`);

// b beats a: strictly cheaper, at least as much data and validity, network and top-up not worse.
const beats = (b, a) =>
  b.price < a.price &&
  b.gb >= a.gb &&
  b.days >= a.days &&
  (b.network === "5G" || a.network === "4G") &&
  (b.top_up === "oui" || a.top_up === "non");
const better = (b, a) =>
  b.gb > a.gb ||
  b.days > a.days ||
  (b.network === "5G" && a.network === "4G") ||
  (b.top_up === "oui" && a.top_up === "non");
let efficient = 0;
for (const l of group(rows, (r) => r.country_code).values())
  efficient += l.filter((a) => !l.some((b) => beats(b, a))).length;
if (m.efficient.count !== efficient) fail(`efficient ${m.efficient.count} != ${efficient}`);

let dominated = 0;
for (const l of group(rows, (r) => `${r.provider}|${r.country_code}`).values())
  dominated += l.filter((a) => l.some((b) => beats(b, a) && better(b, a))).length;
if (stats.audit.dominatedWithinProvider !== dominated)
  fail(`dominated ${stats.audit.dominatedWithinProvider} != ${dominated}`);

const dups = [
  ...group(
    rows,
    (r) => `${r.provider}|${r.country_code}|${r.data_gb}|${r.days}|${r.network}|${r.top_up}`,
  ).values(),
].filter((l) => l.length > 1);
const maxRatio = Math.max(
  ...dups.map((l) => Math.max(...l.map((r) => r.price)) / Math.min(...l.map((r) => r.price))),
);
if (stats.audit.duplicates.groups !== dups.length)
  fail(`duplicates ${stats.audit.duplicates.groups} != ${dups.length}`);
if (!near(stats.audit.duplicates.maxRatio, maxRatio))
  fail(`dup ratio ${stats.audit.duplicates.maxRatio} != ${maxRatio}`);

const outliers = [];
for (const l of plans.values()) {
  if (l.length < 4) continue;
  const med = median(l.map((r) => r.price));
  for (const r of l) if (Math.abs(r.price / med - 1) >= 0.25) outliers.push(r.sku);
}
const got = stats.audit.outliers.map((o) => o.sku).sort();
if (JSON.stringify(got) !== JSON.stringify(outliers.sort())) fail(`outliers ${got} != ${outliers}`);

const bins = new Map();
for (const r of rows)
  bins.set(Math.floor(r.price / 10), (bins.get(Math.floor(r.price / 10)) ?? 0) + 1);
for (const b of stats.bonus.distribution)
  if ((bins.get(b.from / 10) ?? 0) !== b.count) fail(`histogram bin ${b.from}`);
if (stats.bonus.distribution.reduce((s, b) => s + b.count, 0) !== rows.length)
  fail("histogram total");

// The static HTML carries the same figures (no JS needed to read them).
const attr = (sel) => {
  const x = html.match(new RegExp(`${sel}[^>]*data-(?:value|count)="([^"]*)"`));
  if (!x) fail(`${sel} missing in html`);
  return Number(x[1]);
};
if (attr('data-kpi="comparable-plans"') !== comparable.length) fail("html comparable");
if (attr('data-kpi="efficient"') !== efficient) fail("html efficient");
if (!near(attr('data-kpi="median-saving"'), saving)) fail("html saving");
if (attr('data-audit="duplicates"') !== dups.length) fail("html duplicates");
if (attr('data-audit="outliers"') !== outliers.length) fail("html outliers");
if (attr('data-audit="dominated"') !== dominated) fail("html dominated");
const gapText = maxGap.toFixed(2).replace(".", ",");
if (!new RegExp(`data-insight="gap"[\\s\\S]{0,400}${gapText}`).test(home))
  fail(`insight gap ${gapText} not on the home page`);
for (const id of ["insights", "market", "finder", "quality", "kpis", "providers", "bonus"])
  if (!html.includes(`id="${id}"`)) fail(`#${id} missing`);

console.log(
  `plans ${plans.size}, comparable ${comparable.length}, max gap ${gapText} €, efficient ${efficient}, duplicates ${dups.length}, outliers ${outliers.length}, dominated ${dominated}`,
);
console.log("BUSINESS ORACLE PASSED");
