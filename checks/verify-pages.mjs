// Home page: the six brief KPIs, item 6, insights and links to every sub-page. Sub-pages:
// their own sections only. Every page: the shared navigation with the right current page.
import { readFileSync } from "node:fs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const page = (p) => readFileSync(`dist/${p}`, "utf8");
const pages = {
  "/": {
    file: "index.html",
    has: ["kpis", "insights", "providers", "explore"],
    not: ["bonus", "products", "quality"],
  },
  "/analyse": {
    file: "analyse/index.html",
    has: ["bonus", "market", "filters"],
    not: ["kpis", "products", "quality"],
  },
  "/offres": {
    file: "offres/index.html",
    has: ["products", "finder", "filters"],
    not: ["kpis", "bonus", "quality"],
  },
  "/qualite": {
    file: "qualite/index.html",
    has: ["quality", "decisions"],
    not: ["kpis", "filters", "products"],
  },
  "/import": { file: "import/index.html", has: [], not: ["kpis"] },
};
for (const [path, spec] of Object.entries(pages)) {
  const html = page(spec.file);
  for (const id of spec.has) if (!html.includes(`id="${id}"`)) fail(`${path} lacks #${id}`);
  for (const id of spec.not) if (html.includes(`id="${id}"`)) fail(`${path} still renders #${id}`);
  const current = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map(
    (m) => m[1],
  );
  if (JSON.stringify(current) !== JSON.stringify([path]))
    fail(`${path}: aria-current on ${current}`);
  for (const target of Object.keys(pages)) {
    if (!html.includes(`href="${target}"`)) fail(`${path} has no link to ${target}`);
  }
}
const home = page("index.html");
for (const kpi of ["total", "over100", "price-min", "price-max", "avg-data", "avg-price"]) {
  if (!new RegExp(`data-kpi="${kpi}"[^>]*data-value="[^"]+"`).test(home))
    fail(`home lacks KPI ${kpi}`);
}
for (const target of ["/analyse", "/offres", "/qualite"]) {
  if (!new RegExp(`href="${target}"[^>]*data-keep-filters[^>]*data-explore`).test(home))
    fail(`no explore card to ${target}`);
}
const kept = [...home.matchAll(/<a[^>]*href="([^"]+)"[^>]*data-keep-filters/g)].map((m) => m[1]);
for (const p of ["/", "/analyse", "/offres"])
  if (!kept.includes(p)) fail(`nav link ${p} does not keep filters`);
console.log(
  "5 pages: home KPIs 1-6 + explore cards, sections on their own page, nav and current page right",
);
console.log("PAGES OK");
