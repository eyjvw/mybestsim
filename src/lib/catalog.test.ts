import { describe, expect, test } from "bun:test";
import { mergeCatalog, parseSupplierCsv } from "./catalog";
import { HEADER } from "./fixtures";

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
const VALID = "a-1,Airalo,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,12.5,EUR,5G,oui";
const UNLIMITED = "a-2,Airalo,eSIM Asie Illimité 30 jours,AS,Asie,,Illimité,30,97.09,EUR,4G,non";

describe("parseSupplierCsv", () => {
  test("normalises a valid row", () => {
    const { products, rejected } = parseSupplierCsv(csv(VALID), "airalo.csv");
    expect(rejected).toEqual([]);
    expect(products[0]).toEqual({
      sku: "a-1",
      provider: "Airalo",
      name: "eSIM France 5 Go 7 jours",
      countryCode: "FR",
      countryName: "France",
      dataGb: 5,
      validityDays: 7,
      price: 12.5,
      network: "5G",
      topUp: true,
    });
  });

  test("keeps unlimited offers with dataGb null", () => {
    const { products } = parseSupplierCsv(csv(UNLIMITED), "airalo.csv");
    expect(products[0].dataGb).toBeNull();
    expect(products[0].topUp).toBe(false);
  });

  test("strips a UTF-8 BOM and CRLF line endings", () => {
    const text = `﻿${csv(VALID, UNLIMITED).replaceAll("\n", "\r\n")}\r\n`;
    expect(parseSupplierCsv(text, "x.csv").products).toHaveLength(2);
  });

  test.each([
    ["non-EUR currency", "a-3,Airalo,n,FR,France,5,5 Go,7,12.5,USD,4G,oui", "devise"],
    ["unknown network", "a-4,Airalo,n,FR,France,5,5 Go,7,12.5,EUR,3G,oui", "réseau"],
    ["negative price", "a-5,Airalo,n,FR,France,5,5 Go,7,-1,EUR,4G,oui", "price"],
    ["empty data not unlimited", "a-6,Airalo,n,FR,France,,5 Go,7,9,EUR,4G,oui", "Illimité"],
    ["bad top_up", "a-7,Airalo,n,FR,France,5,5 Go,7,9,EUR,4G,yes", "top_up"],
    ["bad country code", "a-8,Airalo,n,fra,France,5,5 Go,7,9,EUR,4G,oui", "code"],
  ])("rejects %s with a readable reason", (_, row, reason) => {
    const { products, rejected } = parseSupplierCsv(csv(VALID, row), "f.csv");
    expect(products).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].line).toBe(3);
    expect(rejected[0].reason).toContain(reason);
  });

  test("rejects a file with missing columns", () => {
    const { products, rejected } = parseSupplierCsv("sku,price\nx,1", "bad.csv");
    expect(products).toEqual([]);
    expect(rejected[0].reason).toContain("colonnes manquantes");
  });
});

describe("mergeCatalog", () => {
  test("merges files and reports duplicate SKUs", () => {
    const { products, quality } = mergeCatalog([
      { file: "a.csv", text: csv(VALID, UNLIMITED) },
      { file: "b.csv", text: csv(VALID) },
    ]);
    expect(products).toHaveLength(2);
    expect(quality).toMatchObject({ files: 2, rows: 3, valid: 2 });
    expect(quality.rejected[0].reason).toContain("sku en double");
  });
});
