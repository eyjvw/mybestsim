// The deployed site through Lighthouse 13.5.0, the version PageSpeed Insights runs: every page,
// three runs on mobile and one on desktop. Accessibility, best practices and SEO must be 100 on
// every run. Performance: 99 or more on desktop; on mobile, 99 or more for the best of the three
// runs and no run under 95. The same build scores 98 to 100 on mobile from one run to the next on
// a laptop: Lighthouse saw the first paint 1.3 or 2.3 s in, where a plain browser paints it at
// 0.35-0.44 s, just after the load event. A real regression lowers every run. Needs network, bunx
// and a Chromium (CHROME_PATH, or Playwright's). Usage: bun checks/verify-pagespeed.mjs [base-url]
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
      const best = Math.max(...perfs);
      const worst = Math.min(...perfs);
      console.log(`${path} ${mode}: performance ${perfs.join("/")}`);
      if (best < 99) bad.push(`${path} ${mode}: best performance ${best}`);
      if (worst < 95) bad.push(`${path} ${mode}: a run at ${worst}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (bad.length) fail(bad.join("; "));
console.log(
  `${PAGES.length} pages, ${LIGHTHOUSE}: accessibility, best practices and SEO 100, performance 99 or more (best mobile run, none under 95)`,
);
console.log("PAGESPEED OK");
