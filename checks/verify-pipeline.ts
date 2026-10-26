// Structure of the v4 pipeline: data-only changes skip CI, e2e on PRs only with a cached
// browser, two images, and the Caddy / compose wiring of /api and /data.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const fail = (msg: string): never => {
  console.error("FAIL:", msg);
  process.exit(1);
};
// biome-ignore lint/suspicious/noExplicitAny: parsed YAML
const load = (p: string) => Bun.YAML.parse(readFileSync(p, "utf8")) as Record<string, any>;
const ci = load(".github/workflows/ci.yml");
for (const ev of ["pull_request", "push"]) {
  const ignored: string[] = ci.on?.[ev]?.["paths-ignore"] ?? [];
  if (!ignored.includes("data/**")) fail(`${ev} does not ignore data/**`);
}
const e2e = ci.jobs?.e2e ?? fail("no e2e job");
if (e2e.if !== "github.event_name != 'push'") fail(`e2e must skip pushes, has if: ${e2e.if}`);
// Browsers come either from a lockfile-keyed cache, or (since the first CI run, where apt took
// 14 minutes) from the official Playwright image of the exact version in package.json.
const pwVersion = JSON.parse(readFileSync("package.json", "utf8")).devDependencies[
  "@playwright/test"
];
const image = String(e2e.container?.image ?? "");
if (image !== `mcr.microsoft.com/playwright:v${pwVersion}-noble`)
  fail(`e2e must run in the Playwright ${pwVersion} image, has "${image}"`);
const imageJob = ci.jobs?.image ?? fail("no image job");
if (imageJob.if !== "github.event_name == 'push'") fail("images are pushed from main only");
// PRs build both images and smoke-test them together instead (idea from an earlier SSR + SQLite
// prototype).
const container = ci.jobs?.container ?? fail("no container smoke job");
if (container.if !== "github.event_name != 'push'") fail("container smoke runs on PRs");
const cRuns = (container.steps ?? []).map((s: { run?: string }) => s.run ?? "").join("\n");
const cTargets = (container.steps ?? [])
  .filter((s: { uses?: string }) => s.uses?.startsWith("docker/build-push-action"))
  .map((s: { with?: { target?: string; load?: boolean } }) => `${s.with?.target}:${s.with?.load}`)
  .sort();
if (JSON.stringify(cTargets) !== JSON.stringify(["ingest:true", "web:true"]))
  fail(`container builds ${cTargets}`);
for (const needle of [
  "node scripts/smoke.mjs http://127.0.0.1:8080",
  "id -u",
  "test -w /data",
  "--entrypoint chown -v mbs-data:/data mbs-ingest:ci bun:bun /data",
  "mbs-data:/live:ro",
  "release lost across restart",
]) {
  if (!cRuns.includes(needle)) fail(`container smoke lacks: ${needle}`);
}
const targets = (imageJob.strategy?.matrix?.include ?? [])
  .map((m: { target: string }) => m.target)
  .sort();
if (JSON.stringify(targets) !== JSON.stringify(["ingest", "web"])) fail(`image targets ${targets}`);
const build = imageJob.steps.find((s: { uses?: string }) =>
  s.uses?.startsWith("docker/build-push-action"),
);
// biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not JS
if (build?.with?.target !== "${{ matrix.target }}")
  fail("build-push does not use the matrix target");
// The independent checks of this folder run in the check job.
if (
  !/\bbun run checks\b/.test(
    (ci.jobs?.check?.steps ?? []).map((s: { run?: string }) => s.run ?? "").join("\n"),
  )
) {
  fail("check job does not run `bun run checks`");
}
const smoke = (ci.jobs?.verify?.steps ?? []).map((s: { run?: string }) => s.run ?? "").join("\n");
if (!smoke.includes("/api/health") || !smoke.includes("/data/version.json"))
  fail("live smoke test ignores /api and /data");
const report = load(".github/workflows/data-report.yml");
if (!(report.on?.pull_request?.paths ?? []).includes("data/**")) fail("data PRs lost their report");

const docker = readFileSync("Dockerfile", "utf8");
const stages = [...docker.matchAll(/^FROM \S+ AS (\S+)/gm)].map((m) => m[1]);
if (!stages.includes("ingest") || stages.at(-1) !== "web")
  fail(`Dockerfile stages ${stages} (web must stay last)`);
if (!/CMD \["bun", "server\/main\.ts"\]/.test(docker))
  fail("ingest stage does not start the server");
if (!/chown bun:bun \/data/.test(docker)) fail("ingest cannot write its volume");

const caddy = readFileSync("docker/Caddyfile", "utf8");
if (!/handle \/api\/\* \{[\s\S]*?reverse_proxy \{\$INGEST_UPSTREAM:ingest:3000\}/.test(caddy))
  fail("Caddy does not proxy /api");
if (!/handle_path \/data\/\* \{[\s\S]*?root \* \/live\/current/.test(caddy))
  fail("Caddy does not serve the volume's current release");
if (!/max_size 6MB/.test(caddy)) fail("no upload size limit at the proxy");

const compose = load("deploy/docker-compose.yml");
const web = compose.services?.mybestsim ?? fail("compose: no web service");
const ingest = compose.services?.["mybestsim-ingest"] ?? fail("compose: no ingest service");
if (!web.volumes?.includes("mybestsim-data:/live:ro"))
  fail("web must mount the data read-only on /live");
const init = compose.services?.["mybestsim-data-init"] ?? fail("compose: no volume init service");
if (
  init.user !== "0" ||
  JSON.stringify(init.entrypoint) !== JSON.stringify(["chown", "bun:bun", "/data"])
)
  fail("volume init must chown /data to bun");
if (ingest.depends_on?.["mybestsim-data-init"]?.condition !== "service_completed_successfully")
  fail("ingest must wait for the volume init");
if (!ingest.volumes?.includes("mybestsim-data:/data")) fail("ingest must mount the data volume");
// Watchtower pulls what the image job pushes: ghcr.io/<owner>/<repo>[-ingest], lowercase.
const repo = (
  process.env.GITHUB_REPOSITORY ??
  execSync("git remote get-url origin")
    .toString()
    .trim()
    .replace(/^.*github\.com[:/]/, "")
    .replace(/\.git$/, "")
).toLowerCase();
const images = {
  mybestsim: `ghcr.io/${repo}:latest`,
  "mybestsim-ingest": `ghcr.io/${repo}-ingest:latest`,
  "mybestsim-data-init": `ghcr.io/${repo}-ingest:latest`,
};
for (const [service, image] of Object.entries(images))
  if (compose.services[service].image !== image)
    fail(`compose ${service} pulls ${compose.services[service].image}, CI pushes ${image}`);
if (ingest.environment?.INGEST_TOKEN)
  fail("the token must come from env_file, never from the compose file");
// The e2e live server must get SIGTERM, or its ephemeral volume stays in the temp directory.
const pw = readFileSync("playwright.config.ts", "utf8");
const live = pw.slice(pw.indexOf("server/main.ts --ephemeral"));
if (!/gracefulShutdown: \{ signal: "SIGTERM"/.test(live.slice(0, live.indexOf("env:"))))
  fail("the e2e live server is SIGKILLed: its ephemeral volume is never removed");
console.log("PIPELINE OK");
