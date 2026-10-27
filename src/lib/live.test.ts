import { describe, expect, test } from "bun:test";
import { auditCatalog, summarizeAudit } from "./audit";
import { applyFilters, DEFAULT_FILTERS, filterOptions } from "./filters";
import { product } from "./fixtures";
import { answer, summarizeCatalog } from "./live";
import { loadCatalog } from "./load";
import { computeStats } from "./stats";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("summarizeCatalog", () => {
  const { products } = loadCatalog();
  const summary = summarizeCatalog(products);

  // The dashboard shows these stats whenever no filter is set: they must be exactly what it
  // would compute itself from the unfiltered view.
  test("its stats equal those of the view with the default filters", () => {
    expect(summary.stats).toEqual(computeStats(applyFilters(products, DEFAULT_FILTERS)));
    expect(summary.stats.total).toBe(5056);
  });

  test("its audit and filter choices are those of the whole catalog", () => {
    expect(summary.audit).toEqual(summarizeAudit(auditCatalog(products)));
    expect(summary.options).toEqual(filterOptions(products));
  });
});

describe("answer", () => {
  const live = [product({ sku: "a", price: 10 }), product({ sku: "b", price: 12 })];

  test("loads the release it is asked for and sends the products as JSON text", async () => {
    const asked: string[] = [];
    const reply = await answer({ base: "/sandbox/data" }, async (u) => {
      asked.push(u);
      return u.endsWith("version.json")
        ? ok({ importId: "s1" })
        : u.endsWith("catalog.json")
          ? ok({ products: live })
          : ok(null);
    });
    if (!reply.ok) throw new Error("expected a reply");
    expect(asked).toContain("/sandbox/data/catalog.json");
    expect(reply.catalog).toMatchObject({ source: "live", version: { importId: "s1" } });
    expect(reply.catalog).not.toHaveProperty("products");
    expect(JSON.parse(reply.products)).toEqual(live);
    expect(reply.summary.stats.total).toBe(2);
    expect(reply.summary.options.providers).toEqual(["Airalo"]);
  });

  test("no catalog anywhere is a failed reply, not an exception", async () => {
    const reply = await answer({ base: "/data" }, async () => new Response("", { status: 404 }));
    expect(reply).toEqual({ ok: false });
  });
});
