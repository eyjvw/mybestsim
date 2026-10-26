import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { processInbox } from "./inbox";
import { csv, row, tempStore } from "./testing";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

describe("processInbox", () => {
  test("imports settled files and moves them next to their report", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    writeFileSync(join(t.store.inboxDir, "beta.csv"), csv(row("b-1", "Beta", 8)));
    expect(await processInbox(t.store, Date.now())).toBeNull(); // still settling
    const o = await processInbox(t.store, Date.now() + 5000);
    expect(o?.status).toBe("published");
    const done = join(t.store.inboxDir, "done", o?.importId as string);
    expect(readdirSync(done).sort()).toEqual(["beta.csv", "report.md"]);
    expect(existsSync(join(t.store.inboxDir, "beta.csv"))).toBe(false);
  });

  test("a rejected file goes to inbox/rejected and the release stays", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const before = t.store.currentId();
    writeFileSync(
      join(t.store.inboxDir, "beta.csv"),
      csv("b-1,Beta,x,FR,France,5,5 Go,7,-1,EUR,4G,oui"),
    );
    const o = await processInbox(t.store, Date.now() + 5000);
    expect(o?.status).toBe("rejected");
    expect(t.store.currentId()).toBe(before);
    const [dir] = readdirSync(join(t.store.inboxDir, "rejected"));
    expect(readdirSync(join(t.store.inboxDir, "rejected", dir)).sort()).toEqual([
      "beta.csv",
      "report.md",
    ]);
  });

  test("ignores non-CSV files", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    writeFileSync(join(t.store.inboxDir, "notes.txt"), "x");
    expect(await processInbox(t.store, Date.now() + 5000)).toBeNull();
  });
});
