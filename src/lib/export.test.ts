import { describe, expect, test } from "bun:test";
import { parseSupplierCsv } from "./catalog";
import { SUPPLIER_HEADER, toSupplierCsv } from "./export";
import { product } from "./fixtures";
import { loadCatalog } from "./load";

describe("toSupplierCsv", () => {
  test("writes the supplier header and quotes cells that need it", () => {
    const csv = toSupplierCsv([product({ sku: "a-1", name: 'eSIM "France", 5 Go' })]);
    const [header, row] = csv.trim().split("\n");
    expect(header).toBe(SUPPLIER_HEADER.join(","));
    expect(row).toContain('"eSIM ""France"", 5 Go"');
  });

  test("round-trips through the import validator", () => {
    const products = [
      product({ dataGb: null, network: "5G", topUp: false, price: 97.09 }),
      product({ dataGb: 3, price: 11.4 }),
    ];
    const parsed = parseSupplierCsv(toSupplierCsv(products), "export.csv");
    expect(parsed.rejected).toEqual([]);
    expect(parsed.products).toEqual(products);
  });

  test("round-trips the whole real catalog", () => {
    const { products } = loadCatalog();
    const parsed = parseSupplierCsv(toSupplierCsv(products), "export.csv");
    expect(parsed.rejected).toEqual([]);
    expect(parsed.products).toEqual(products);
  });
});
