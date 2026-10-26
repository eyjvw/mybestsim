// Smoke test of a running deployment (web + ingest, or the ingest server in static mode).
// Usage: node scripts/smoke.mjs <base-url> <publish-token>, from the repo root.
// Publishes one new offer, so run it on a fresh or throw-away volume.
import { readFileSync } from "node:fs";

const [base, token] = process.argv.slice(2);
if (!base || !token) {
  console.error("usage: node scripts/smoke.mjs <base-url> <publish-token>");
  process.exit(2);
}
const fail = (msg) => {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
};
const get = async (path) => {
  const r = await fetch(base + path);
  if (!r.ok) fail(`GET ${path} returned ${r.status}`);
  return r;
};
const post = (text, { auth, query = "" } = {}) =>
  fetch(`${base}/api/imports${query}`, {
    method: "POST",
    headers: { "Content-Type": "text/csv", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: text,
  });

const html = await (await get("/")).text();
if (!html.includes('data-kpi="total"')) fail("dashboard KPIs missing from the HTML");
const build = await (await get("/version.json")).json();
const health = await (await get("/api/health")).json();
if (!health.ok || !health.importId) fail("ingest health");
const live = await (await get("/data/version.json")).json();
if (live.importId !== health.importId) fail("/data is not the ingest volume's current release");
const before = await (await get("/data/catalog.json")).json();

// One new offer for an existing provider: a small, valid, publishable change.
const roamic = readFileSync("data/roamic.csv", "utf8").trimEnd();
const next = `${roamic}\nroamic-998877,Roamic,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,13.37,EUR,5G,oui\n`;

if ((await post(next)).status !== 401) fail("publishing without a token must be refused");
const preview = await (await post(next, { query: "?dryRun=1&file=roamic.csv" })).json();
if (preview.status !== "preview" || preview.summary.added !== 1)
  fail(`dry run: ${JSON.stringify(preview)}`);
const published = await post(next, { auth: token, query: "?file=roamic.csv" });
const body = await published.json();
if (published.status !== 201) fail(`publish returned ${published.status}: ${JSON.stringify(body)}`);
const again = await (await post(next, { auth: token, query: "?file=roamic.csv" })).json();
if (again.status !== "unchanged") fail("the same file twice must be unchanged");

const after = await (await get("/data/catalog.json")).json();
if (after.products.length !== before.products.length + 1)
  fail("new offer missing from /data/catalog.json");
if ((await (await get("/version.json")).json()).sha !== build.sha) fail("the site was rebuilt");
console.log(
  `SMOKE PASSED (build ${String(build.sha).slice(0, 7)}, release ${body.importId}, ${after.products.length} offres)`,
);
