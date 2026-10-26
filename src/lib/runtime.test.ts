import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import { isSandbox, loadCatalog, SANDBOX_DATA, withSandbox } from "./runtime";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const html404 = () =>
  new Response("<h1>404</h1>", { status: 404, headers: { "Content-Type": "text/html" } });

describe("loadCatalog", () => {
  const live = [product({ sku: "live" })];
  const snapshot = [product({ sku: "snap" })];

  test("prefers the live data and its version and changes", async () => {
    const r = await loadCatalog(async (u) =>
      u === "/data/catalog.json"
        ? ok({ products: live })
        : u === "/data/version.json"
          ? ok({ importId: "i2" })
          : u === "/data/changes.json"
            ? ok({ importId: "i2", added: 1 })
            : ok({ products: snapshot }),
    );
    expect(r.source).toBe("live");
    expect(r.products[0].sku).toBe("live");
    expect(r.version?.importId).toBe("i2");
    expect(r.changes?.added).toBe(1);
  });

  test("falls back to the build snapshot when /data is missing or not JSON", async () => {
    const r = await loadCatalog(async (u) =>
      u.startsWith("/data/") ? html404() : ok({ products: snapshot }),
    );
    expect(r).toMatchObject({ source: "build", version: null, changes: null });
    expect(r.products[0].sku).toBe("snap");
    // A static host answering 200 with its HTML page is not live data either.
    const spa = await loadCatalog(async (u) =>
      u.startsWith("/data/")
        ? new Response("<html>", { headers: { "Content-Type": "text/html" } })
        : ok({ products: snapshot }),
    );
    expect(spa.source).toBe("build");
  });

  test("the static placeholder (no importId) skips the other live files", async () => {
    const asked: string[] = [];
    const r = await loadCatalog(async (u) => {
      asked.push(u);
      return u === "/data/version.json" ? ok({ live: false }) : ok({ products: snapshot });
    });
    expect(r.source).toBe("build");
    expect(asked).toEqual(["/data/version.json", "/catalog.json"]);
  });

  test("network errors fall back too; no catalog at all is an error", async () => {
    const r = await loadCatalog(async (u) => {
      if (u.startsWith("/data/")) throw new TypeError("offline");
      return ok({ products: snapshot });
    });
    expect(r.source).toBe("build");
    await expect(loadCatalog(async () => html404())).rejects.toThrow("catalogue introuvable");
  });
});

describe("sandbox data", () => {
  test("loadCatalog reads the base it is given", async () => {
    const asked: string[] = [];
    const r = await loadCatalog(async (u) => {
      asked.push(u);
      return u.endsWith("version.json")
        ? ok({ importId: "s1" })
        : u.endsWith("catalog.json")
          ? ok({ products: [product({ sku: "demo" })] })
          : ok(null);
    }, SANDBOX_DATA);
    expect(r.source).toBe("live");
    expect(r.products[0].sku).toBe("demo");
    expect(asked.sort()).toEqual([
      "/sandbox/data/catalog.json",
      "/sandbox/data/changes.json",
      "/sandbox/data/version.json",
    ]);
  });

  test("?bac=1 turns the sandbox on, other values do not", () => {
    expect(isSandbox("?bac=1")).toBe(true);
    expect(isSandbox("?fournisseur=Airalo&bac=1")).toBe(true);
    expect(isSandbox("?bac=0")).toBe(false);
    expect(isSandbox("")).toBe(false);
  });

  test("withSandbox keeps the filters and adds or removes only the flag", () => {
    expect(withSandbox("?fournisseur=Airalo", true)).toBe("?fournisseur=Airalo&bac=1");
    expect(withSandbox("?fournisseur=Airalo&bac=1", false)).toBe("?fournisseur=Airalo");
    expect(withSandbox("?bac=1", false)).toBe("");
    expect(withSandbox("", true)).toBe("?bac=1");
  });
});
