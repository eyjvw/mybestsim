// End-to-end through the real HTTP server: publish, reject, hold, refuse, and check the
// live catalog and stats against an independent recomputation of the resulting CSV set.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { group, median, near, readDir, readRows } from "./lib/raw.mjs";
import { startServer } from "./lib/server.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const srv = await startServer();
const get = async (p) => (await fetch(srv.base + p)).json();
const post = (name, text, { token = "oracle-token-0123456789abcdef", query = "" } = {}) => {
  const form = new FormData();
  form.append("file", new File([text], name, { type: "text/csv" }));
  return fetch(`${srv.base}/api/imports${query}`, {
    method: "POST",
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });
};

try {
  const seed = await get("/data/version.json");
  if (!seed.importId || seed.source !== "seed") fail(`no seed release: ${JSON.stringify(seed)}`);
  const header = readFileSync("data/airalo.csv", "utf8").split("\n")[0];

  // A valid "next day" Roamic file built here, independently of the app's sample code:
  // two prices changed, one offer removed, one added.
  const roamic = readFileSync("data/roamic.csv", "utf8").trim().split("\n").slice(1);
  const edited = roamic.slice(1).map((l, i) => {
    if (i > 1) return l;
    const c = l.split(",");
    c[8] = (Number(c[8]) + 1.5).toFixed(2);
    return c.join(",");
  });
  edited.push("roamic-999001,Roamic,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,13.37,EUR,5G,oui");
  const roamicNext = `${header}\n${edited.join("\n")}\n`;

  const before = await get("/api/health");
  // Refusals first: none of them may change the current release.
  if ((await post("roamic.csv", roamicNext, { token: "nope" })).status !== 401)
    fail("bad token not refused");
  const invalid = await post(
    "roamic.csv",
    `${header}\nroamic-1,Roamic,x,JP,Japon,5,5 Go,15,9,USD,4G,oui\n`,
  );
  if (invalid.status !== 422) fail(`invalid file status ${invalid.status}`);
  const wild = roamic.map((l) => {
    const c = l.split(",");
    c[8] = (Number(c[8]) * 2).toFixed(2);
    return c.join(",");
  });
  if ((await post("roamic.csv", `${header}\n${wild.join("\n")}\n`)).status !== 409)
    fail("guard did not hold a doubled price list");
  if ((await get("/api/health")).importId !== before.importId)
    fail("a refused import changed the release");

  const res = await post("roamic.csv", roamicNext);
  const out = await res.json();
  if (res.status !== 201 || out.status !== "published")
    fail(`publish failed: ${res.status} ${JSON.stringify(out.reasons)}`);
  if (out.summary.added !== 1 || out.summary.removed !== 1 || out.summary.up !== 2)
    fail(`summary ${JSON.stringify(out.summary)}`);

  // Independent recomputation from the CSV files of the new release on disk.
  const csvDir = join(srv.volume, "current", "csv");
  if (!readdirSync(csvDir).includes("roamic.csv")) fail("roamic.csv not kept under its name");
  const rows = readDir(csvDir);
  const expectedRows = [
    ...readDir("data").filter((r) => r.provider !== "Roamic"),
    ...readRows(join(csvDir, "roamic.csv")),
  ];
  if (rows.length !== expectedRows.length) fail("release CSV set differs from data/ + upload");
  const catalog = await get("/data/catalog.json");
  const stats = await get("/data/stats.json");
  const changes = await get("/data/changes.json");
  const prices = rows.map((r) => r.price);
  if (catalog.products.length !== rows.length || stats.total !== rows.length)
    fail(`total ${stats.total} != ${rows.length}`);
  if (stats.over100.count !== prices.filter((p) => p > 100).length) fail("over100");
  if (!near(stats.price.avg, prices.reduce((a, b) => a + b, 0) / prices.length)) fail("avg price");
  if (!near(stats.price.median, median(prices))) fail("median price");
  const finite = rows.filter((r) => Number.isFinite(r.gb)).map((r) => r.gb);
  if (!near(stats.data.avgGb, finite.reduce((a, b) => a + b, 0) / finite.length)) fail("avg data");
  const byProvider = group(rows, (r) => r.provider);
  for (const p of stats.byProvider)
    if (byProvider.get(p.provider)?.length !== p.count) fail(`provider ${p.provider}`);
  if (changes.previousImportId !== before.importId || changes.importId !== out.importId)
    fail("changes ids");
  if (changes.added !== 1 || changes.removed !== 1 || changes.up !== 2)
    fail(`changes ${JSON.stringify(changes)}`);
  if ((await get("/data/version.json")).importId !== out.importId) fail("version.json not swapped");
  const history = (await get("/api/imports")).imports.map((h) => h.status);
  if (JSON.stringify(history) !== JSON.stringify(["published", "held", "rejected"]))
    fail(`history ${history}`);

  console.log(
    `published ${out.importId}: ${rows.length} offers (+1 −1, 2 repriced); 401, 422 and 409 left the release untouched`,
  );
  console.log("INGEST ORACLE PASSED");
} finally {
  srv.stop();
}
