import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { product } from "./fixtures";
import { answer, type LiveReply } from "./live";
import { loadLive, type WorkerLike } from "./live-client";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const live = [product({ sku: "w1" }), product({ sku: "w2" })];
const liveFetch = async (u: string) =>
  u.endsWith("version.json")
    ? ok({ importId: "i9" })
    : u.endsWith("catalog.json")
      ? ok({ products: live })
      : ok(null);

/** A stand-in Worker answering with `reply` (or failing), recording what it was sent. */
function fakeWorker(reply: (msg: { base: string }) => Promise<LiveReply> | "error") {
  const sent: unknown[] = [];
  let terminated = false;
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(msg) {
      sent.push(msg);
      const r = reply(msg as { base: string });
      if (r === "error") queueMicrotask(() => w.onerror?.(new ErrorEvent("error")));
      else r.then((data) => w.onmessage?.(new MessageEvent("message", { data })));
    },
    terminate() {
      terminated = true;
    },
  };
  return { w, sent, terminated: () => terminated };
}

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe("loadLive", () => {
  test("takes the products and the summary from the worker", async () => {
    const fake = fakeWorker((msg) => answer(msg, liveFetch));
    const c = await loadLive("/data", () => fake.w);
    expect(fake.sent).toEqual([{ base: "/data" }]);
    expect(fake.terminated()).toBe(true);
    expect(c.source).toBe("live");
    expect(c.version?.importId).toBe("i9");
    expect(c.products).toEqual(live);
    expect(c.summary?.stats.total).toBe(2);
  });

  test("falls back to the main thread when the worker fails, cannot start or has no data", async () => {
    spyOn(globalThis, "fetch").mockImplementation((async (u: string) =>
      liveFetch(u)) as unknown as typeof fetch);
    for (const create of [
      () => fakeWorker(() => "error").w,
      () => fakeWorker(async () => ({ ok: false }) as const).w,
      (): WorkerLike => {
        throw new ReferenceError("Worker is not defined");
      },
    ]) {
      const c = await loadLive("/data", create);
      expect(c.source).toBe("live");
      expect(c.products).toEqual(live);
      expect(c.summary).toBeUndefined();
    }
  });
});
