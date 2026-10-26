// Public sandbox, through the real server: an anonymous publish lands under /sandbox/data while
// production's data and history stay byte-identical, production still needs the token, the
// per-client hourly limit answers 429, and a reset brings back the seed catalogue.
import { readFileSync } from "node:fs";
import { readDir } from "./lib/raw.mjs";
import { startServer } from "./lib/server.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const seedCount = readDir("data").filter((r) => r.valid).length;
const roamic = readFileSync("data/roamic.csv", "utf8").trimEnd();
// Each call adds one different offer, so every publish is a real change.
const next = (n) =>
  `${roamic}\nroamic-99${String(n).padStart(4, "0")},Roamic,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,1${n}.37,EUR,5G,oui\n`;
const publish = (base, text, ip = "198.51.100.20", path = "/api/sandbox/imports") =>
  fetch(`${base}${path}?file=roamic.csv`, {
    method: "POST",
    headers: { "Content-Type": "text/csv", "X-Forwarded-For": ip },
    body: text,
  });
const text = async (base, path) => (await fetch(base + path)).text();

const srv = await startServer({ SANDBOX_PUBLISHES_PER_HOUR: "3" });
const production = async () =>
  Promise.all(
    ["/data/version.json", "/data/catalog.json", "/api/imports"].map((p) => text(srv.base, p)),
  );
const before = await production();

const first = await publish(srv.base, next(1));
const body = await first.json();
if (first.status !== 201) fail(`sandbox publish: ${first.status} ${JSON.stringify(body)}`);
const version = JSON.parse(await text(srv.base, "/sandbox/data/version.json"));
if (version.importId !== body.importId) fail("/sandbox/data does not serve the new release");
const catalog = JSON.parse(await text(srv.base, "/sandbox/data/catalog.json"));
if (catalog.products.length !== seedCount + 1)
  fail(`sandbox catalogue has ${catalog.products.length} offers, expected ${seedCount + 1}`);
if (!catalog.products.some((p) => p.sku === "roamic-990001")) fail("new offer missing");

if ((await publish(srv.base, next(2), undefined, "/api/imports")).status !== 401)
  fail("production publish without a token was not refused");
const after = await production();
if (after.some((t, i) => t !== before[i])) fail("a sandbox publish changed production");

// Limit 3 per hour and client: publishes 2 and 3 pass, the 4th is refused, another client passes.
for (const n of [3, 4]) {
  const r = await publish(srv.base, next(n));
  if (r.status !== 201) fail(`publish ${n} refused early: ${r.status}`);
}
if ((await publish(srv.base, next(5))).status !== 429) fail("4th publish within the hour accepted");
if ((await publish(srv.base, next(6), "203.0.113.50")).status !== 201)
  fail("the limit is not per client");
srv.stop();

// Reset: a server resetting every 1.5 s returns to the seed and forgets the history.
const resetting = await startServer({ SANDBOX_RESET_EVERY_MS: "1500" });
const published = await (await publish(resetting.base, next(7))).json();
if (!published.importId) fail("publish before the reset failed");
let reset = null;
for (let i = 0; i < 100 && !reset; i++) {
  await new Promise((r) => setTimeout(r, 100));
  const v = JSON.parse(await text(resetting.base, "/sandbox/data/version.json"));
  if (v.importId !== published.importId && v.source === "seed") reset = v;
}
if (!reset) fail("the sandbox was not reset");
const resetCatalog = JSON.parse(await text(resetting.base, "/sandbox/data/catalog.json"));
if (resetCatalog.products.length !== seedCount) fail("the reset did not restore the seed");
const history = JSON.parse(await text(resetting.base, "/api/sandbox/imports"));
if (history.imports.length !== 0) fail("the reset kept the history");
resetting.stop();

console.log(
  `sandbox publish without token, production byte-identical, 401 on production, 429 after 3 per hour per client, reset back to ${seedCount} seed offers`,
);
console.log("SANDBOX ORACLE PASSED");
