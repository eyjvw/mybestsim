// The deployed site through Lighthouse 13.5.0, the version PageSpeed Insights runs: every page,
// three runs on mobile and one on desktop. Accessibility, best practices and SEO must be 100 on
// every run, performance at least 99 (median on mobile, where runs vary). Needs network, bunx and
// a Chromium (CHROME_PATH, or Playwright's). Usage: bun checks/verify-pagespeed.mjs [base-url]
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const BASE = process.argv[2] ?? "https://mybestsim.sbonneau.xyz";
const PAGES = ["/", "/analyse", "/offres", "/qualite", "/import", "/blog/internet-croisiere-esim/"];
const LIGHTHOUSE = "lighthouse@13.5.0";
const pw = join(homedir(), ".cache/ms-playwright");
const chrome =
  process.env.CHROME_PATH ??
  (existsSync(pw)
    ? readdirSync(pw)
        .filter((d) => /^chromium-\d+$/.test(d))
        .map((d) => join(pw, d, "chrome-linux64/chrome"))
        .find(existsSync)
    : undefined);
if (!chrome) fail("no Chromium: set CHROME_PATH or run `bunx playwright install chromium`");

// cwd: under WSL, chrome-launcher writes its profile to a relative "C:\Users\..." folder.
const dir = mkdtempSync(join(tmpdir(), "mbs-lighthouse-"));
const bad = [];
try {
  for (const path of PAGES) {
    for (const [mode, runs] of [
      ["mobile", 3],
      ["desktop", 1],
    ]) {
      const perfs = [];
      for (let i = 0; i < runs; i++) {
        const out = join(dir, "report.json");
        const flags = mode === "desktop" ? ["--preset=desktop"] : [];
        const r = spawnSync(
          "bunx",
          [
            "--bun",
            LIGHTHOUSE,
            BASE + path,
            ...flags,
            "--quiet",
            "--chrome-flags=--headless=new --no-sandbox",
            "--output=json",
            `--output-path=${out}`,
          ],
          {
            encoding: "utf8",
            cwd: dir,
            env: { ...process.env, CHROME_PATH: chrome },
            timeout: 240_000,
          },
        );
        if (r.status !== 0) fail(`${path} ${mode}: lighthouse failed ${r.stderr.slice(-300)}`);
        const report = JSON.parse(readFileSync(out, "utf8"));
        const score = (k) => Math.round((report.categories[k].score ?? 0) * 100);
        for (const k of ["accessibility", "best-practices", "seo"])
          if (score(k) !== 100) bad.push(`${path} ${mode}: ${k} ${score(k)}`);
        perfs.push(score("performance"));
      }
      const median = perfs.sort((a, b) => a - b)[perfs.length >> 1];
      console.log(`${path} ${mode}: performance ${perfs.join("/")}`);
      if (median < 99) bad.push(`${path} ${mode}: performance ${median}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (bad.length) fail(bad.join("; "));
console.log(
  `${PAGES.length} pages, ${LIGHTHOUSE}: accessibility, best practices and SEO 100, performance 99 or more`,
);
console.log("PAGESPEED OK");
