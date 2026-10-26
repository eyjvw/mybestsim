import { afterEach, describe, expect, test } from "bun:test";
import { createApp } from "./app";
import type { ImportOutcome } from "./store";
import { csv, row, tempStore } from "./testing";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

function setup(token: string | null = "secret") {
  const t = tempStore();
  cleanups.push(t.cleanup);
  const notified: ImportOutcome[] = [];
  const app = createApp(t.store, {
    token,
    maxBytes: 1024 * 1024,
    notify: async (o) => {
      notified.push(o);
    },
  });
  return { ...t, app, notified };
}

const upload = (text: string, init: { token?: string; query?: string; name?: string } = {}) => {
  const form = new FormData();
  form.append("file", new File([text], init.name ?? "beta.csv", { type: "text/csv" }));
  return new Request(`http://x/api/imports${init.query ?? ""}`, {
    method: "POST",
    body: form,
    headers: init.token ? { Authorization: `Bearer ${init.token}` } : {},
  });
};

describe("ingest API", () => {
  test("publishes a multipart upload with the right token and notifies", async () => {
    const { app, notified, store } = setup();
    const res = await app(upload(csv(row("b-1", "Beta", 8)), { token: "secret" }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as ImportOutcome;
    expect(body.importId).toBe(store.currentId());
    expect(notified.map((o) => o.status)).toEqual(["published"]);
  });

  test("accepts a raw text/csv body", async () => {
    const { app } = setup();
    const res = await app(
      new Request("http://x/api/imports?file=beta.csv", {
        method: "POST",
        body: csv(row("b-1", "Beta", 7)),
        headers: { Authorization: "Bearer secret", "Content-Type": "text/csv" },
      }),
    );
    expect(res.status).toBe(201);
  });

  test("refuses a missing or wrong token, and publishing when no token is configured", async () => {
    expect((await setup().app(upload(csv(row("b-1", "Beta", 8))))).status).toBe(401);
    expect((await setup().app(upload(csv(row("b-1", "Beta", 8)), { token: "nope" }))).status).toBe(
      401,
    );
    expect((await setup(null).app(upload(csv(row("b-1", "Beta", 8)), { token: "x" }))).status).toBe(
      503,
    );
  });

  test("dry runs need no token and change nothing", async () => {
    const { app, store, notified } = setup();
    const before = store.currentId();
    const res = await app(upload(csv(row("b-1", "Beta", 8)), { query: "?dryRun=1" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as ImportOutcome).status).toBe("preview");
    expect(store.currentId()).toBe(before);
    expect(notified).toEqual([]);
  });

  test("status codes for rejected, held, too big and wrong type", async () => {
    const { app } = setup();
    const bad = await app(
      upload(csv("b-1,Beta,x,FR,France,5,5 Go,7,9,USD,4G,oui"), { token: "secret" }),
    );
    expect(bad.status).toBe(422);
    const wild = csv(...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, "Alpha", 100)));
    expect((await app(upload(wild, { token: "secret", name: "alpha.csv" }))).status).toBe(409);
    expect(
      (await app(upload(wild, { token: "secret", name: "alpha.csv", query: "?force=1" }))).status,
    ).toBe(201);
    expect((await app(upload("x".repeat(1024 * 1024 + 1), { token: "secret" }))).status).toBe(413);
    expect((await app(upload("hello", { token: "secret", name: "notes.txt" }))).status).toBe(415);
    const json = new Request("http://x/api/imports", {
      method: "POST",
      body: "{}",
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
    });
    expect((await app(json)).status).toBe(415);
  });

  test("health, history and data files", async () => {
    const { app, store } = setup();
    await app(upload(csv(row("b-1", "Beta", 8)), { token: "secret" }));
    expect(await (await app(new Request("http://x/api/health"))).json()).toEqual({
      ok: true,
      importId: store.currentId(),
    });
    const h = (await (await app(new Request("http://x/api/imports"))).json()) as {
      imports: unknown[];
    };
    expect(h.imports).toHaveLength(1);
    const v = await app(new Request("http://x/data/version.json"));
    expect(v.status).toBe(200);
    expect(((await v.json()) as { importId: string }).importId).toBe(store.currentId() as string);
    expect((await app(new Request("http://x/data/../../etc/passwd"))).status).toBe(404);
    expect((await app(new Request("http://x/api/nope"))).status).toBe(404);
  });

  test("failed tokens are rate limited before the comparison, per client", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const app = createApp(t.store, {
      token: "secret",
      maxBytes: 1024 * 1024,
      limits: { authFailures: 2, previews: 2 },
    });
    const body = csv(row("b-1", "Beta", 8));
    expect((await app(upload(body, { token: "bad" }), "1.1.1.1")).status).toBe(401);
    expect((await app(upload(body, { token: "bad" }), "1.1.1.1")).status).toBe(401);
    // Even the right token is refused while the window lasts: guessing gains nothing.
    expect((await app(upload(body, { token: "secret" }), "1.1.1.1")).status).toBe(429);
    expect((await app(upload(body, { token: "secret" }), "2.2.2.2")).status).toBe(201);
  });

  test("anonymous previews are rate limited too", async () => {
    const t = tempStore();
    cleanups.push(t.cleanup);
    const app = createApp(t.store, {
      token: "secret",
      maxBytes: 1024 * 1024,
      limits: { authFailures: 2, previews: 2 },
    });
    const body = csv(row("b-1", "Beta", 8));
    for (let i = 0; i < 2; i++)
      expect((await app(upload(body, { query: "?dryRun=1" }), "3.3.3.3")).status).toBe(200);
    expect((await app(upload(body, { query: "?dryRun=1" }), "3.3.3.3")).status).toBe(429);
  });

  test("the same file sent twice is unchanged the second time", async () => {
    const { app, store, notified } = setup();
    const body = csv(row("b-1", "Beta", 8));
    expect((await app(upload(body, { token: "secret" }))).status).toBe(201);
    const id = store.currentId();
    const again = await app(upload(body, { token: "secret" }));
    expect(again.status).toBe(200);
    expect(((await again.json()) as ImportOutcome).status).toBe("unchanged");
    expect(store.currentId()).toBe(id);
    expect(notified.map((o) => o.status)).toEqual(["published", "unchanged"]);
  });
});

describe("sandbox API", () => {
  function sandboxSetup(publishesPerHour = 3) {
    const prod = tempStore();
    const demo = tempStore();
    cleanups.push(prod.cleanup, demo.cleanup);
    const notified: ImportOutcome[] = [];
    const app = createApp(prod.store, {
      token: "secret",
      maxBytes: 1024 * 1024,
      notify: async (o) => {
        notified.push(o);
      },
      sandbox: { store: demo.store, publishesPerHour },
    });
    return { app, prod: prod.store, demo: demo.store, notified };
  }
  const sandboxUpload = (text: string, ip = "198.51.100.7", query = "") => {
    const form = new FormData();
    form.append("file", new File([text], "beta.csv", { type: "text/csv" }));
    return new Request(`http://x/api/sandbox/imports${query}`, {
      method: "POST",
      body: form,
      headers: { "X-Forwarded-For": ip },
    });
  };

  test("publishes without a token into the sandbox only, and pages nobody", async () => {
    const { app, prod, demo, notified } = sandboxSetup();
    const prodBefore = prod.currentId();
    const res = await app(sandboxUpload(csv(row("b-1", "Beta", 8))));
    expect(res.status).toBe(201);
    const body = (await res.json()) as ImportOutcome;
    expect(body.importId).toBe(demo.currentId());
    expect(prod.currentId()).toBe(prodBefore);
    expect(prod.history()).toEqual([]);
    expect(notified).toEqual([]);
    const health = await (await app(new Request("http://x/api/sandbox/health"))).json();
    expect(health).toEqual({ ok: true, importId: demo.currentId() });
  });

  test("production still needs the token", async () => {
    const { app } = sandboxSetup();
    expect((await app(upload(csv(row("b-1", "Beta", 8))))).status).toBe(401);
  });

  test("the hourly publish limit is per client, and previews do not use it", async () => {
    const { app } = sandboxSetup(2);
    for (const price of [8, 7]) {
      expect((await app(sandboxUpload(csv(row("b-1", "Beta", price))))).status).toBe(201);
    }
    expect((await app(sandboxUpload(csv(row("b-1", "Beta", 6))))).status).toBe(429);
    expect((await app(sandboxUpload(csv(row("b-1", "Beta", 6)), "203.0.113.9"))).status).toBe(201);
    const preview = await app(sandboxUpload(csv(row("b-1", "Beta", 5)), undefined, "?dryRun=1"));
    expect(preview.status).toBe(200);
  });

  test("the sandbox data is served under /sandbox/data in static mode", async () => {
    const { app, demo } = sandboxSetup();
    await app(sandboxUpload(csv(row("b-1", "Beta", 8))));
    const v = await (await app(new Request("http://x/sandbox/data/version.json"))).json();
    expect(v.importId).toBe(demo.currentId());
    expect((await app(new Request("http://x/sandbox/data/../../etc/passwd"))).status).toBe(404);
  });

  test("without a sandbox, its routes answer 404", async () => {
    const { app } = setup();
    expect((await app(new Request("http://x/api/sandbox/health"))).status).toBe(404);
    expect((await app(sandboxUpload(csv(row("b-1", "Beta", 8))))).status).toBe(404);
  });
});
