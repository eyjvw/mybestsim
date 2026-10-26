// Local Bun = packageManager pin = Docker base image = README (and CLAUDE.md when present: it
// lives in the Obsidian vault, so CI has none), and a frozen install does not rewrite bun.lock.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const local = spawnSync("bun", ["--version"], { encoding: "utf8" }).stdout.trim();
const pin = JSON.parse(readFileSync("package.json", "utf8")).packageManager?.replace(/^bun@/, "");
const docker = readFileSync("Dockerfile", "utf8").match(/^FROM oven\/bun:(\S+)/m)?.[1];
const readme = readFileSync("README.md", "utf8").match(
  /Prérequis : \[Bun\]\([^)]+\) (\d+\.\d+\.\d+)/,
)?.[1];
const all = { local, pin, docker, readme };
if (existsSync("CLAUDE.md"))
  all.claude = readFileSync("CLAUDE.md", "utf8").match(/\| Bun (\d+\.\d+\.\d+)/)?.[1];
if (new Set(Object.values(all)).size !== 1 || !local)
  fail(`versions differ: ${JSON.stringify(all)}`);

const hash = () => createHash("sha256").update(readFileSync("bun.lock")).digest("hex");
const before = hash();
const r = spawnSync("bun", ["install", "--frozen-lockfile"], { encoding: "utf8" });
if (r.status !== 0) fail(`frozen install failed: ${r.stderr.slice(-400)}`);
if (hash() !== before) fail("bun install rewrote bun.lock");
console.log(`Bun ${local} in ${Object.keys(all).join(", ")}; lockfile stable`);
console.log("TOOLCHAIN OK");
