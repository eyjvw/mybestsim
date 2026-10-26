import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEADER } from "../src/lib/fixtures";
import { DataStore } from "./store";

export const row = (sku: string, provider: string, price: number) =>
  `${sku},${provider},eSIM France 5 Go 7 jours,FR,France,5,5 Go,7,${price},EUR,4G,oui`;
export const csv = (...rows: string[]) => `${[HEADER, ...rows].join("\n")}\n`;
export const alpha = (price = (i: number) => 10 + i) =>
  csv(...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, "Alpha", price(i))));

/** A store on a temporary volume seeded with two small providers. */
export function tempStore() {
  const root = mkdtempSync(join(tmpdir(), "mbs-store-"));
  const seed = join(root, "seed");
  mkdirSync(seed);
  writeFileSync(join(seed, "alpha.csv"), alpha());
  writeFileSync(join(seed, "beta.csv"), csv(row("b-1", "Beta", 9)));
  const store = new DataStore(join(root, "volume"), { seedDir: seed, keep: 3 });
  store.init();
  return { store, root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
