import { SUPPLIER_HEADER, toSupplierCsv, toSupplierRow } from "./export";
import type { Product } from "./types";

/**
 * A plausible "next day" file for one provider, built from today's catalog, so the import
 * preview can be tried without a real supplier file. Deterministic: same input, same file.
 * It removes 2 offers, reprices 6, adds 3 and appends 2 rows the validator must reject
 * (unless `invalidRows: false`, for a file that can be published).
 */
export const SAMPLE_CHANGES = { removed: 2, repriced: 6, added: 3, invalid: 2 } as const;

const REPRICE_FACTORS = [0.85, 0.92, 0.97, 1.04, 1.1, 1.25];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSampleImport(
  catalog: Product[],
  provider: string,
  options: { invalidRows?: boolean } = {},
): string {
  const own = catalog
    .filter((p) => p.provider === provider)
    .sort((a, b) => a.sku.localeCompare(b.sku));
  if (own.length < 20) throw new Error(`not enough ${provider} offers to build a sample`);

  // Spread the edits across the file instead of touching its first rows only.
  const step = Math.floor(own.length / 12);
  const removedIdx = new Set([step, step * 7]);
  const repricedIdx = REPRICE_FACTORS.map((_, i) => step * (i * 2 + 2));

  const rows: Product[] = [];
  own.forEach((p, i) => {
    if (removedIdx.has(i)) return;
    const r = repricedIdx.indexOf(i);
    rows.push(r === -1 ? p : { ...p, price: round2(p.price * REPRICE_FACTORS[r]) });
  });

  const prefix = own[0].sku.replace(/-\d+$/, "");
  const templates = [own[3], own[step * 5], own[step * 9]];
  templates.forEach((t, i) => {
    rows.push({
      ...t,
      sku: `${prefix}-9${String(i + 1).padStart(5, "0")}`,
      validityDays: t.validityDays === 30 ? 15 : 30,
      name: t.name.replace(/\d+ jours$/, `${t.validityDays === 30 ? 15 : 30} jours`),
      price: round2(t.price * 1.3),
    });
  });

  const bad = (p: Product, patch: Partial<Record<(typeof SUPPLIER_HEADER)[number], string>>) => {
    const cells = toSupplierRow(p);
    for (const [k, v] of Object.entries(patch)) {
      cells[SUPPLIER_HEADER.indexOf(k as (typeof SUPPLIER_HEADER)[number])] = v as string;
    }
    return cells.join(",");
  };
  const invalid = [
    bad({ ...own[5], sku: `${prefix}-990001` }, { currency: "USD" }),
    bad({ ...own[6], sku: `${prefix}-990002` }, { price: "-4.99" }),
  ];
  if (options.invalidRows === false) return toSupplierCsv(rows);
  return `${toSupplierCsv(rows)}${invalid.join("\n")}\n`;
}
