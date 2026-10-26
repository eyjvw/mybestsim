import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Catalog, mergeCatalog } from "./catalog";

export const DATA_DIR = join(process.cwd(), "data");

let cached: Catalog | undefined;

/** Reads every supplier CSV in `data/` (build time only). */
export function loadCatalog(dir = DATA_DIR): Catalog {
  if (cached && dir === DATA_DIR) return cached;
  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));
  const catalog = mergeCatalog(files);
  if (dir === DATA_DIR) cached = catalog;
  return catalog;
}
