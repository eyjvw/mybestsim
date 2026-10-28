import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import { buildInsights } from "./insights";
import { loadCatalog } from "./load";
import { computeStats } from "./stats";

describe("buildInsights", () => {
  test("real catalog leads with the same-plan price gap", () => {
    const insights = buildInsights(computeStats(loadCatalog().products), 10);
    const ids = insights.map((i) => i.id);
    expect(ids[0]).toBe("gap");
    expect(ids).toContain("dominated");
    expect(ids).toContain("unlimited");
    expect(ids).toContain("5g");
    expect(insights.find((i) => i.id === "5g")?.title).toBe(
      "La 5G ne coûte pas plus cher que la 4G",
    );
    expect(insights[0].title).toContain("60,37");
  });

  test("states nothing the selection cannot support", () => {
    expect(buildInsights(computeStats([]))).toEqual([]);
    const one = buildInsights(computeStats([product()]));
    expect(one.map((i) => i.id)).not.toContain("gap");
    expect(one.map((i) => i.id)).not.toContain("dominated");
  });

  test("reports a real 5G premium when there is one", () => {
    const s = computeStats([
      product({ network: "4G", price: 10 }),
      product({ network: "5G", price: 12, provider: "B" }),
    ]);
    const title = buildInsights(s, 10).find((i) => i.id === "5g")?.title ?? "";
    expect(title.replace(/[\u202f\u00a0]/g, " ")).toBe("La 5G coûte 20 % de plus");
  });

  test("respects the limit", () => {
    expect(buildInsights(computeStats(loadCatalog().products), 2)).toHaveLength(2);
  });

  test("the home page shows three, the plainest first", () => {
    const ids = buildInsights(computeStats(loadCatalog().products)).map((i) => i.id);
    expect(ids).toEqual(["gap", "unlimited", "5g"]);
    // Dominated offers need the most explaining: stated only when there is room for it.
    const all = buildInsights(computeStats(loadCatalog().products), 10).map((i) => i.id);
    expect(all.at(-1)).toBe("dominated");
  });
});
