// Structural check of the CI workflows and Dependabot config (Bun.YAML parses them).
import { readFileSync } from "node:fs";

const fail = (msg: string): never => {
  console.error("FAIL:", msg);
  process.exit(1);
};
type Step = { run?: string; uses?: string; if?: string; with?: Record<string, unknown> };
type Job = {
  needs?: string | string[];
  if?: string;
  steps?: Step[];
  permissions?: Record<string, string>;
};
// biome-ignore lint/suspicious/noExplicitAny: parsed YAML, shape checked field by field below
const load = (p: string) => Bun.YAML.parse(readFileSync(p, "utf8")) as Record<string, any>;
const runs = (job: Job) => (job.steps ?? []).map((s) => s.run ?? "").join("\n");

const ci = load(".github/workflows/ci.yml");
const e2e: Job = ci.jobs?.e2e ?? fail("ci.yml has no e2e job");
// Chromium and its libraries: installed by a step, or (v4) preinstalled in the Playwright image.
const installs = runs(e2e);
const inImage = String(
  (e2e as { container?: { image?: string } }).container?.image ?? "",
).startsWith("mcr.microsoft.com/playwright:");
if (!inImage && !/bunx playwright install (--with-deps )?chromium/.test(installs))
  fail("e2e job does not install Chromium");
if (!inImage && !/--with-deps chromium|bunx playwright install-deps chromium/.test(installs))
  fail("e2e job lacks Chromium system deps");
if (!/\bbun run e2e\b/.test(runs(e2e))) fail("e2e job does not run `bun run e2e`");
if (
  !(e2e.steps ?? []).some(
    (s) => s.uses?.startsWith("actions/upload-artifact") && s.if === "failure()",
  )
)
  fail("e2e job does not keep the report on failure");
const needs = [ci.jobs?.image?.needs].flat();
// v4: images are pushed from main only, after the PR already passed e2e.
const pushOnly =
  ci.jobs?.image?.if === "github.event_name == 'push'" && e2e.if === "github.event_name != 'push'";
if (!needs.includes("check") || (!needs.includes("e2e") && !pushOnly))
  fail("image job must follow check, and e2e must gate it on PRs");
if (!/\bbun test\b/.test(runs(ci.jobs.check))) fail("check job lost the unit tests");

const dr = load(".github/workflows/data-report.yml");
const paths: string[] = dr.on?.pull_request?.paths ?? [];
if (!paths.includes("data/**")) fail("data-report must trigger on data/** PRs");
if (dr.permissions?.["pull-requests"] !== "write") fail("data-report needs pull-requests: write");
const report: Job = dr.jobs?.report ?? fail("data-report has no report job");
const script = runs(report);
if (!/scripts\/data-report\.ts --base .* --head data --out report\.md/.test(script))
  fail("report step missing");
if (!/GITHUB_STEP_SUMMARY/.test(script)) fail("report not added to the job summary");
const marker = readFileSync("src/lib/report.ts", "utf8").match(/REPORT_MARKER = "([^"]+)"/)?.[1];
if (!marker || !script.includes(marker)) fail("comment step does not use the report marker");
if (!/git archive "\$BASE_SHA" data/.test(script))
  fail("base data not taken from the PR base commit");

const deps = load(".github/dependabot.yml");
const eco = new Set(
  (deps.updates ?? []).map((u: { "package-ecosystem": string }) => u["package-ecosystem"]),
);
for (const e of ["bun", "github-actions", "docker"])
  if (!eco.has(e)) fail(`dependabot misses ${e}`);

console.log("WORKFLOWS OK");
