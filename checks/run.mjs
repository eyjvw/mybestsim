// Runs the independent checks: each recomputes what the site or the service shows from the raw
// CSV files with its own naive parser, never with the code under test. Run after `bun run build`.
// Usage: bun run checks           checks that need nothing but the repository (CI runs these)
//        bun run checks --local   also those needing local tools (Caddy, the dataviz validator,
//                                 a git tag and Playwright browsers)
//        bun run checks:live      the deployed site (after a deploy)
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CI = [
  ["verify-kpis.mjs", "the six brief KPIs in stats.json and in the home page HTML"],
  ["verify-business.mjs", "savings, wins, 5G premium, unbeaten offers, audit and histogram"],
  ["verify-pages.mjs", "each section on its page, navigation and current page"],
  ["verify-article.mjs", "part 2 article: length and structure from the analysis, SEO, prices"],
  ["verify-seo.mjs", "every page: one main landmark, indexable, canonical, in the sitemap"],
  ["verify-brand.mjs", "MyBestSim tokens and self-hosted fonts in the built CSS"],
  ["verify-diff.mjs", "the import report against an independent SKU diff"],
  ["verify-ingest.mjs", "publish through the real server, refusals change nothing"],
  ["verify-sandbox.mjs", "public sandbox: no token, production untouched, hourly limit, reset"],
  ["verify-inbox-webhook.mjs", "inbox folder import and webhook payload"],
  ["verify-hardening.mjs", "short tokens, rate limits, unchanged re-sends, CLI"],
  ["verify-smoke-local.mjs", "scripts/smoke.mjs against the real server"],
  ["verify-workflows.ts", "CI and Dependabot structure"],
  ["verify-pipeline.ts", "data-only changes skipped, images, Caddy and compose wiring"],
  ["verify-toolchain.mjs", "one Bun version everywhere, lockfile stable"],
  ["verify-unit.mjs", "every src/lib module has its own passing tests"],
  ["verify-readme.mjs", "README links, screenshots and every figure it states"],
];
const LOCAL = [
  ["verify-palette.mjs", "chart colours through the dataviz palette validator"],
  ["verify-caddy.mjs", "the image Caddyfile with a real Caddy 2 binary"],
  ["verify-overflow-control.mjs", "negative control: the overflow test fails on the old layout"],
  ["verify-article-links.mjs", "every external link of the article answers (network)"],
];
const LIVE = [["verify-live.mjs", "the deployed site, its data, headers and neighbours"]];

const args = process.argv.slice(2);
const list = args.includes("--live") ? LIVE : args.includes("--local") ? [...CI, ...LOCAL] : CI;
let failed = 0;
for (const [file, what] of list) {
  const started = Date.now();
  const r = spawnSync("bun", [join("checks", file)], { encoding: "utf8", timeout: 600_000 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const out = `${r.stdout}${r.stderr}`.trim();
  if (r.status === 0) {
    console.log(`PASS ${file} (${seconds}s): ${what}`);
  } else {
    failed += 1;
    console.log(`FAIL ${file} (${seconds}s): ${what}\n${out.split("\n").slice(-15).join("\n")}`);
  }
}
if (failed) {
  console.log(`${failed} of ${list.length} checks failed`);
  process.exit(1);
}
console.log(`ALL CHECKS PASSED (${list.length})`);
