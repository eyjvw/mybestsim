// Negative control for the overflow e2e test: it must FAIL on the pre-fix layout (tag
// pre-mobile-fix) and PASS on the current build. Run from the repo root after `bun run build`.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Last commit with the pre-fix layout, tagged in the repository (main before the UI PR).
const BASE = process.env.CONTROL_REF ?? "pre-mobile-fix";
const GREP = "overflow on / at (360|390)px";
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });

const dir = mkdtempSync(join(tmpdir(), "mbs-control-"));
const tree = join(dir, "tree");
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  spawnSync("git", ["worktree", "remove", "--force", tree]);
  rmSync(dir, { recursive: true, force: true });
};
// fail() calls process.exit, which skips `finally`: remove the worktree on exit as well.
process.on("exit", cleanup);
try {
  execFileSync("git", ["worktree", "add", "--detach", tree, BASE], { stdio: "ignore" });
  for (const args of [
    ["install", "--frozen-lockfile"],
    ["run", "build"],
  ]) {
    const r = run("bun", args, { cwd: tree });
    if (r.status !== 0) fail(`bun ${args.join(" ")} in ${BASE}: ${r.stderr.slice(-400)}`);
  }

  const pw = (env) =>
    run(
      "bunx",
      ["playwright", "test", "e2e/responsive.e2e.ts", "-g", GREP, "--reporter=line", "--retries=0"],
      {
        env: { ...process.env, ...env },
      },
    );

  const before = pw({ E2E_DIST: join(tree, "dist"), E2E_PORT: "4333" });
  const beforeOut = before.stdout + before.stderr;
  if (before.status === 0) fail(`overflow test passed on ${BASE}: it cannot detect the bug`);
  if (!/2 failed/.test(beforeOut))
    fail(`expected 2 failures on ${BASE}, got:\n${beforeOut.slice(-600)}`);
  const px = [...beforeOut.matchAll(/Received: (\d+)/g)].map((m) => Number(m[1]));
  if (px.length !== 2 || px.some((n) => n <= 0)) fail(`expected two positive overflows, got ${px}`);

  const after = pw({});
  const afterOut = after.stdout + after.stderr;
  if (after.status !== 0 || !/2 passed/.test(afterOut))
    fail(`overflow test fails on the fix:\n${afterOut.slice(-600)}`);

  console.log(
    `${BASE}: page overflows by ${px.sort((a, b) => a - b).join(" and ")} px on the 390 and 360 px screens (test fails as it should); fix: 0 px`,
  );
  console.log("OVERFLOW CONTROL OK");
} finally {
  cleanup();
}
