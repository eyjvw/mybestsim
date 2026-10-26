import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEADER } from "./fixtures";
import { loadCatalog } from "./load";

describe("loadCatalog", () => {
  test("reads only .csv files of a directory, in name order", () => {
    const dir = mkdtempSync(join(tmpdir(), "mbs-load-"));
    try {
      writeFileSync(
        join(dir, "b.csv"),
        `${HEADER}\nb-1,B,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,9,EUR,4G,oui\n`,
      );
      writeFileSync(
        join(dir, "a.CSV"),
        `${HEADER}\na-1,A,eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,9,EUR,4G,oui\n`,
      );
      writeFileSync(join(dir, "notes.txt"), "ignored");
      const { products, quality } = loadCatalog(dir);
      expect(products.map((p) => p.sku)).toEqual(["a-1", "b-1"]);
      expect(quality.files).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
