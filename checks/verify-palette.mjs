// Runs the dataviz palette validator on the chart slots declared in global.css, light on
// the white surface and dark on the navy surface.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
// The validator ships with Claude Code's bundled dataviz skill, unpacked under
// <tmp>/claude-<uid>/bundled-skills; DATAVIZ_VALIDATOR overrides.
const find = () => {
  if (process.env.DATAVIZ_VALIDATOR) return process.env.DATAVIZ_VALIDATOR;
  const base = join(tmpdir(), `claude-${process.getuid?.() ?? ""}`, "bundled-skills");
  if (!existsSync(base)) fail(`no ${base}: set DATAVIZ_VALIDATOR to validate_palette.js`);
  for (const v of readdirSync(base).sort().reverse())
    for (const h of readdirSync(join(base, v))) {
      const p = join(base, v, h, "dataviz/scripts/validate_palette.js");
      try {
        readFileSync(p);
        return p;
      } catch {}
    }
  return fail("dataviz validate_palette.js not found (set DATAVIZ_VALIDATOR)");
};
const validator = find();
const css = readFileSync("src/styles/global.css", "utf8");
const block = (sel) =>
  css.match(new RegExp(`${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? fail(`${sel} block missing`);
const slots = (b) =>
  ["s1", "s2", "s3"].map(
    (k) => b.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? fail(`--${k} missing`),
  );
const surface = (b) => b.match(/--surface:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? fail("--surface missing");

const light = block(":root");
const dark = block(':root\\[data-theme="dark"\\]');
for (const [mode, b] of [
  ["light", light],
  ["dark", dark],
]) {
  const r = spawnSync(
    "node",
    [validator, slots(b).join(","), "--mode", mode, "--surface", surface(b)],
    { encoding: "utf8" },
  );
  const out = r.stdout + r.stderr;
  if (r.status !== 0 || !out.includes("ALL CHECKS PASS")) fail(`${mode} palette fails:\n${out}`);
  // A sub-3:1 slot is legal only with visible labels: SplitBar prints every value.
  const warn = out.match(/\[WARN\] Contrast[^\n]*/)?.[0];
  console.log(
    `${mode} ${slots(b).join(",")} on ${surface(b)}: pass${warn ? ` (relief: direct labels) ${warn.trim()}` : ""}`,
  );
}
console.log("PALETTE OK");
