import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { DataStore, newImportId } from "./store";
import { alpha, csv, row, tempStore } from "./testing";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

const read = (dir: string, name: string) =>
  JSON.parse(readFileSync(join(dir, "current", name), "utf8"));

describe("DataStore", () => {
  test("seeds an empty volume once, as a first release without changes", () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const id = t.store.currentId();
    expect(id).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{4}$/);
    expect(readlinkSync(t.store.currentLink)).toBe(`releases/${id}`);
    expect(read(t.store.dir, "catalog.json").products).toHaveLength(13);
    expect(read(t.store.dir, "version.json")).toMatchObject({
      source: "seed",
      files: ["alpha.csv", "beta.csv"],
    });
    expect(read(t.store.dir, "changes.json")).toBeNull();
    t.store.init();
    expect(t.store.currentId()).toBe(id);
  });

  test("a valid import becomes the current release, with changes and a log line", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const before = t.store.currentId();
    const o = await t.store.import(
      [{ file: "beta.csv", text: csv(row("b-1", "Beta", 8), row("b-2", "Beta", 12)) }],
      { source: "api" },
    );
    expect(o.status).toBe("published");
    expect(t.store.currentId()).toBe(o.importId);
    expect(read(t.store.dir, "stats.json").total).toBe(14);
    expect(read(t.store.dir, "changes.json")).toMatchObject({
      previousImportId: before,
      added: 1,
      down: 1,
    });
    expect(readFileSync(join(t.store.dir, "current", "csv", "beta.csv"), "utf8")).toContain("b-2");
    expect(t.store.history()[0]).toMatchObject({
      status: "published",
      importId: o.importId,
      source: "api",
    });
  });

  test("rejected and held imports leave the current release untouched", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const before = t.store.currentId();
    const bad = await t.store.import(
      [{ file: "beta.csv", text: csv("b-1,Beta,x,FR,France,5,5 Go,7,9,USD,4G,oui") }],
      { source: "api" },
    );
    expect(bad.status).toBe("rejected");
    expect(bad.rejected[0].reason).toContain("devise");
    const wild = await t.store.import([{ file: "alpha.csv", text: alpha((i) => (10 + i) * 3) }], {
      source: "api",
    });
    expect(wild.status).toBe("held");
    expect(t.store.currentId()).toBe(before);
    expect(t.store.history().map((h) => h.status)).toEqual(["held", "rejected"]);
  });

  test("dry runs report without writing anything", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const before = t.store.currentId();
    const o = await t.store.import([{ file: "beta.csv", text: csv(row("b-1", "Beta", 8)) }], {
      source: "api",
      dryRun: true,
    });
    expect(o).toMatchObject({ status: "preview", importId: null, summary: { down: 1 } });
    expect(t.store.currentId()).toBe(before);
    expect(t.store.history()).toEqual([]);
  });

  test("concurrent imports are serialized and old releases pruned", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const results = await Promise.all(
      [8, 7, 6, 5].map((p) =>
        t.store.import([{ file: "beta.csv", text: csv(row("b-1", "Beta", p)) }], { source: "api" }),
      ),
    );
    expect(results.every((r) => r.status === "published")).toBe(true);
    expect(
      read(t.store.dir, "catalog.json").products.find((p: { sku: string }) => p.sku === "b-1")
        .price,
    ).toBe(5);
    const releases = readdirSync(t.store.releasesDir).filter((d) => !d.startsWith("."));
    expect(releases).toHaveLength(3);
    expect(releases).toContain(t.store.currentId() as string);
    expect(existsSync(join(t.store.releasesDir, ".staging"))).toBe(false);
  });

  test("ids sort chronologically, even within the same millisecond", () => {
    const at = new Date("2030-01-01T10:00:00Z");
    const ids = Array.from({ length: 50 }, () => newImportId(at));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
  });

  test("an identical file is unchanged: no release, logged", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const before = t.store.currentId();
    const o = await t.store.import([{ file: "beta.csv", text: csv(row("b-1", "Beta", 9)) }], {
      source: "api",
    });
    expect(o.status).toBe("unchanged");
    expect(t.store.currentId()).toBe(before);
    expect(t.store.history()[0].status).toBe("unchanged");
  });

  test("the volume lock makes a second process wait, and a stale lock is taken over", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const other = new DataStore(t.store.dir, { lockTimeoutMs: 200 });
    mkdirSync(join(t.store.dir, ".lock"));
    await expect(
      other.import([{ file: "beta.csv", text: csv(row("b-1", "Beta", 7)) }], { source: "api" }),
    ).rejects.toThrow("verrouillé");
    const old = new Date(Date.now() - 10 * 60_000);
    utimesSync(join(t.store.dir, ".lock"), old, old);
    const o = await other.import([{ file: "beta.csv", text: csv(row("b-1", "Beta", 7)) }], {
      source: "api",
    });
    expect(o.status).toBe("published");
    expect(existsSync(join(t.store.dir, ".lock"))).toBe(false);
  });
});
