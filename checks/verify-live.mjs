// Live deployment oracle: the public URL serves the commit at origin/main with correct figures,
// live data and security headers, and the other sites behind the shared Caddy still answer.
// Usage: bun run checks:live (after a deploy).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expectedFrom } from "./lib/expected.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const base = process.env.SITE_URL ?? "https://mybestsim.sbonneau.xyz";
execSync("git fetch -q origin main");
const head = execSync("git rev-parse origin/main").toString().trim();
const exp = expectedFrom("data");

const version = await (await fetch(`${base}/version.json`, { cache: "no-store" })).json();
if (version.sha !== head) fail(`live sha ${version.sha} != origin/main ${head}`);
const stats = await (await fetch(`${base}/stats.json`)).json();
if (stats.total !== exp.total || stats.over100.count !== exp.over100) fail("live stats mismatch");
const page = await fetch(`${base}/`);
if (page.status !== 200) fail(`home status ${page.status}`);
const html = await page.text();
if (!html.includes(`data-kpi="total"`)) fail("home lacks kpi");
const health = await (await fetch(`${base}/api/health`)).json();
if (!health.ok || !health.importId) fail("ingest health");
const live = await (await fetch(`${base}/data/version.json`)).json();
if (live.importId !== health.importId) fail("/data is not the ingest volume's current release");
const sandbox = await (await fetch(`${base}/api/sandbox/health`)).json();
const sandboxData = await (await fetch(`${base}/sandbox/data/version.json`)).json();
if (!sandbox.ok || sandboxData.importId !== sandbox.importId) fail("sandbox not served");
for (const h of [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
]) {
  if (!page.headers.get(h)) fail(`missing header ${h}`);
}
// The live policy is the one versioned in deploy/Caddyfile, and the Server header is gone.
const csp = readFileSync("deploy/Caddyfile", "utf8").match(
  /Content-Security-Policy "([^"]+)"/,
)?.[1];
if (page.headers.get("content-security-policy") !== csp)
  fail("live CSP differs from deploy/Caddyfile");
if (page.headers.get("server")) fail(`Server header leaks: ${page.headers.get("server")}`);
for (const site of ["https://vynq.dev/", "https://sbonneau.xyz/", "https://stats.vynq.dev/"]) {
  const r = await fetch(site, { redirect: "manual" });
  if (r.status >= 500 || r.status === 0) fail(`${site} -> ${r.status}`);
}
console.log("LIVE ORACLE PASSED");
