// Every logic module in src/lib has a sibling *.test.ts with tests, and `bun test` is green.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
// Type-only files, test fixtures and env constants have no logic to test.
const EXEMPT = new Set(["types.ts", "fixtures.ts", "build-info.ts"]);
const modules = readdirSync("src/lib").filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !EXEMPT.has(f),
);
if (modules.length < 15) fail(`only ${modules.length} modules found, expected the v2 set`);
for (const m of modules) {
  const t = `src/lib/${m.replace(/\.ts$/, ".test.ts")}`;
  if (!existsSync(t)) fail(`${m} has no ${t}`);
  const src = readFileSync(t, "utf8");
  if (!/\btest(\.each)?\(/.test(src)) fail(`${t} declares no test`);
  if (!src.includes(`./${m.replace(/\.ts$/, "")}"`)) fail(`${t} does not import ./${m}`);
}
const r = spawnSync("bun", ["test"], { encoding: "utf8" });
const out = r.stdout + r.stderr;
const pass = Number(out.match(/(\d+) pass/)?.[1] ?? 0);
const failed = Number(out.match(/(\d+) fail/)?.[1] ?? -1);
if (r.status !== 0 || failed !== 0 || pass === 0)
  fail(`bun test: ${pass} pass, ${failed} fail\n${out.slice(-800)}`);
console.log(`${modules.length} modules covered, ${pass} unit tests passing`);
console.log("UNIT COVERAGE OK");
