import type { Product } from "./types";

/** Same 12 columns as the supplier files, so an export can be re-imported as is. */
export const SUPPLIER_HEADER = [
  "sku",
  "provider",
  "product_name",
  "country_code",
  "country_name",
  "data_gb",
  "data_display",
  "validity_days",
  "price",
  "currency",
  "network",
  "top_up",
] as const;

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toSupplierRow(p: Product): string[] {
  return [
    p.sku,
    p.provider,
    p.name,
    p.countryCode,
    p.countryName,
    p.dataGb === null ? "" : String(p.dataGb),
    p.dataGb === null ? "Illimité" : `${p.dataGb} Go`,
    String(p.validityDays),
    String(p.price),
    "EUR",
    p.network,
    p.topUp ? "oui" : "non",
  ];
}

export function toSupplierCsv(products: Product[]): string {
  const lines = [
    SUPPLIER_HEADER.join(","),
    ...products.map((p) => toSupplierRow(p).map(cell).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}
