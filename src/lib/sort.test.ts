import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import { sortProducts } from "./sort";

describe("sortProducts", () => {
  const a = product({ sku: "a", price: 10, dataGb: 5, name: "Écosse" });
  const b = product({ sku: "b", price: 5, dataGb: null, name: "Espagne" });
  const c = product({ sku: "c", price: 5, dataGb: 20, name: "Allemagne" });

  test("numbers, ties broken by SKU, without mutating the input", () => {
    const input = [a, b, c];
    expect(sortProducts(input, "price", "asc").map((p) => p.sku)).toEqual(["b", "c", "a"]);
    expect(sortProducts(input, "price", "desc").map((p) => p.sku)).toEqual(["a", "b", "c"]);
    expect(input.map((p) => p.sku)).toEqual(["a", "b", "c"]);
  });

  test("unlimited data and its undefined €/Go sort last", () => {
    expect(sortProducts([a, b, c], "dataGb", "asc").map((p) => p.sku)).toEqual(["a", "c", "b"]);
    expect(sortProducts([a, b, c], "eurPerGb", "asc").map((p) => p.sku)).toEqual(["c", "a", "b"]);
  });

  test("French collation for text", () => {
    expect(sortProducts([a, b, c], "name", "asc").map((p) => p.name)).toEqual([
      "Allemagne",
      "Écosse",
      "Espagne",
    ]);
  });
});
