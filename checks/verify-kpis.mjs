// Checks built dist/ against the independent oracle. Run from repo root after build.
import { readFileSync } from "node:fs";
import { expectedFrom } from "./lib/expected.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const exp = expectedFrom("data");
const stats = JSON.parse(readFileSync("dist/stats.json", "utf8"));
const html = readFileSync("dist/index.html", "utf8");
// Since v5 the sections live on sub-pages; the six brief KPIs stay on the home page.
const site = ["index.html", "analyse/index.html", "offres/index.html", "qualite/index.html"]
  .map((p) => readFileSync(`dist/${p}`, "utf8"))
  .join("\n");

const near = (a, b) => Math.abs(a - b) < 0.005;
if (stats.total !== exp.total) fail(`total ${stats.total} != ${exp.total}`);
if (stats.over100.count !== exp.over100) fail(`over100 ${stats.over100.count} != ${exp.over100}`);
if (!near(stats.price.min, exp.min)) fail(`min ${stats.price.min} != ${exp.min}`);
if (!near(stats.price.max, exp.max)) fail(`max ${stats.price.max} != ${exp.max}`);
if (!near(Math.round(stats.price.avg * 100) / 100, exp.avgPrice))
  fail(`avgPrice ${stats.price.avg} != ${exp.avgPrice}`);
if (!near(Math.round(stats.data.avgGb * 100) / 100, exp.avgDataGb))
  fail(`avgGb ${stats.data.avgGb} != ${exp.avgDataGb}`);
if (stats.data.unlimited !== exp.unlimited)
  fail(`unlimited ${stats.data.unlimited} != ${exp.unlimited}`);
const prov = Object.fromEntries(stats.byProvider.map((p) => [p.provider, p.count]));
for (const [k, v] of Object.entries(exp.byProvider))
  if (prov[k] !== v) fail(`provider ${k} ${prov[k]} != ${v}`);
if (Object.keys(prov).length !== Object.keys(exp.byProvider).length) fail("provider set differs");
if (stats.quality.files !== exp.files || stats.quality.rejected.length !== 0)
  fail("quality report mismatch");

// Server-rendered HTML must already carry the six required KPIs (visible before JS).
const kpi = (id) => {
  const m = html.match(new RegExp(`data-kpi="${id}"[^>]*data-value="([^"]+)"`));
  if (!m) fail(`kpi ${id} missing in html`);
  return Number(m[1]);
};
if (kpi("total") !== exp.total) fail("html total");
if (kpi("over100") !== exp.over100) fail("html over100");
if (!near(kpi("price-min"), exp.min) || !near(kpi("price-max"), exp.max)) fail("html range");
if (!near(Math.round(kpi("avg-data") * 100) / 100, exp.avgDataGb)) fail("html avg data");
if (!near(Math.round(kpi("avg-price") * 100) / 100, exp.avgPrice)) fail("html avg price");
for (const id of ["providers", "bonus", "decisions", "quality", "products", "filters"]) {
  if (!site.includes(`id="${id}"`)) fail(`section #${id} missing`);
}
for (const p of Object.keys(exp.byProvider))
  if (!html.includes(p)) fail(`provider ${p} not rendered on the home page`);
const catalog = JSON.parse(readFileSync("dist/catalog.json", "utf8"));
if (catalog.products.length !== exp.total) fail("catalog.json size");
const version = JSON.parse(readFileSync("dist/version.json", "utf8"));
if (typeof version.sha !== "string") fail("version.json sha");
console.log("KPI ORACLE PASSED");
