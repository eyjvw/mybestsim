import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { msUntilNext, scheduleResets } from "./sandbox";
import { DataStore } from "./store";

const PARIS = "Europe/Paris";
const at = (iso: string) => new Date(iso);
const hours = (ms: number) => ms / 3_600_000;

describe("msUntilNext", () => {
  test("next 03:00 in Paris on an ordinary winter day (UTC+1)", () => {
    expect(hours(msUntilNext(at("2026-11-10T21:00:00Z"), 3, PARIS))).toBe(5);
  });

  test("after 03:00 it is the next night, never now", () => {
    expect(hours(msUntilNext(at("2026-11-10T02:00:00Z"), 3, PARIS))).toBe(24);
    expect(msUntilNext(at("2026-11-10T01:59:59Z"), 3, PARIS)).toBe(1000);
  });

  test("summer time (UTC+2)", () => {
    expect(hours(msUntilNext(at("2026-07-01T00:00:00Z"), 3, PARIS))).toBe(1);
  });

  test("the night clocks go forward (29 March 2026, 02:00 -> 03:00)", () => {
    // 22:00 UTC on the 28th is 23:00 in Paris; 03:00 CEST on the 29th is 01:00 UTC.
    expect(hours(msUntilNext(at("2026-03-28T22:00:00Z"), 3, PARIS))).toBe(3);
  });

  test("the night clocks go back (25 October 2026, 03:00 -> 02:00)", () => {
    // 22:00 UTC on the 24th is 00:00 CEST; 03:00 CET on the 25th is 02:00 UTC.
    expect(hours(msUntilNext(at("2026-10-24T22:00:00Z"), 3, PARIS))).toBe(4);
  });
});

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const volume = () => {
  const d = mkdtempSync(join(tmpdir(), "mbs-sandbox-test-"));
  dirs.push(d);
  return d;
};
const seedDir = join(import.meta.dir, "..", "data");

describe("DataStore.reset", () => {
  test("publishes the seed again, drops the other releases and the history", async () => {
    const store = new DataStore(volume(), { seedDir });
    store.init();
    const first = store.currentId();
    const roamic = store.currentFiles().find((f) => f.file === "roamic.csv");
    if (!roamic) throw new Error("no roamic.csv in the seed");
    const edited =
      roamic.text.replace(/\n$/, "") +
      "\nroamic-999001,Roamic,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,13.37,EUR,5G,oui\n";
    const out = await store.import([{ file: "roamic.csv", text: edited }], { source: "api" });
    expect(out.status).toBe("published");
    expect(store.history(5)).toHaveLength(1);

    const id = await store.reset();
    expect(store.currentId()).toBe(id);
    expect(id).not.toBe(first);
    expect(readdirSync(store.releasesDir).filter((d) => !d.startsWith("."))).toEqual([id]);
    expect(store.history(5)).toEqual([]);
    expect(store.currentFiles().find((f) => f.file === "roamic.csv")?.text).toBe(roamic.text);
  });
});

describe("scheduleResets", () => {
  test("resets on schedule and stops when asked", async () => {
    const store = new DataStore(volume(), { seedDir });
    store.init();
    const ids: string[] = [];
    const stop = scheduleResets(store, {
      hour: 3,
      timeZone: PARIS,
      everyMs: 30,
      onReset: (id) => ids.push(id),
    });
    // A reset republishes the whole seed (5 056 rows): wait for two, whatever the machine speed.
    for (let i = 0; i < 200 && ids.length < 2; i++) await Bun.sleep(50);
    stop();
    expect(ids.length).toBeGreaterThanOrEqual(2);
    // A reset already running when stop() is called may still finish; none starts after it.
    await Bun.sleep(1500);
    const count = ids.length;
    await Bun.sleep(500);
    expect(ids.length).toBe(count);
    expect(store.currentId()).toBe(ids.at(-1) ?? null);
  });
});
