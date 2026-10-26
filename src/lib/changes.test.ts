import { describe, expect, test } from "bun:test";
import { summarizeChanges } from "./changes";
import { diffCatalogs } from "./diff";
import { product } from "./fixtures";

describe("summarizeChanges", () => {
  const a = product({ sku: "a", price: 10 });
  const b = product({ sku: "b", price: 20 });
  const gone = product({ sku: "g" });
  const diff = diffCatalogs(
    [a, b, gone],
    [{ ...a, price: 12 }, { ...b, price: 10 }, product({ sku: "n" })],
  );
  const meta = { importId: "i2", importedAt: "2026-10-26T10:00:00.000Z", previousImportId: "i1" };

  test("counts and samples, biggest move first", () => {
    const s = summarizeChanges(diff, meta);
    expect(s).toMatchObject({ ...meta, added: 1, removed: 1, up: 1, down: 1, modified: 0 });
    expect(s.topMoves.map((m) => [m.sku, m.before, m.price])).toEqual([
      ["b", 20, 10],
      ["a", 10, 12],
    ]);
    expect(s.addedSample[0]).toEqual({
      sku: "n",
      provider: "Airalo",
      label: "France 5 Go 7 j",
      price: 10,
    });
    expect(s.removedSample.map((o) => o.sku)).toEqual(["g"]);
  });

  test("respects the sample limit", () => {
    expect(summarizeChanges(diff, meta, 1).topMoves).toHaveLength(1);
  });
});
