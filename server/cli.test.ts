import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { csv, row, tempStore } from "./testing";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

const cli = (...args: string[]) =>
  spawnSync("bun", ["scripts/import.ts", ...args], { encoding: "utf8" });

describe("bun run import", () => {
  test("publishes into the volume, then reports unchanged and refusals", () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const file = join(t.root, "beta.csv");
    writeFileSync(file, csv(row("b-1", "Beta", 8)));
    const ok = cli("--data-dir", t.store.dir, file);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("publié");
    const version = JSON.parse(readFileSync(join(t.store.dir, "current", "version.json"), "utf8"));
    expect(version.importId).toBe(t.store.currentId() as string);

    expect(cli("--data-dir", t.store.dir, file).stdout).toContain("inchangé");
    expect(cli("--data-dir", t.store.dir, "--dry-run", file).status).toBe(0);

    writeFileSync(file, csv("b-1,Beta,x,FR,France,5,5 Go,7,9,USD,4G,oui"));
    const bad = cli("--data-dir", t.store.dir, file);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("refusé");
    expect(bad.stdout).toContain("devise");
  });

  test("usage error without files", () => {
    expect(cli().status).toBe(2);
  });
});
