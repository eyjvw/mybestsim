import Papa from "papaparse";
import { z } from "zod";
import type { FileReport, Product, QualityReport, RejectedRow } from "./types";

const HEADER = [
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

const positiveNumber = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "nombre attendu")
  .transform(Number)
  .refine((n) => n > 0, "doit être > 0");

const rowSchema = z
  .object({
    sku: z.string().trim().min(1, "sku vide"),
    provider: z.string().trim().min(1, "fournisseur vide"),
    product_name: z.string().trim().min(1, "nom vide"),
    country_code: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, "code destination invalide"),
    country_name: z.string().trim().min(1, "destination vide"),
    data_gb: z.union([z.literal("").transform(() => null), positiveNumber]),
    data_display: z.string().trim(),
    validity_days: positiveNumber.refine(Number.isInteger, "durée entière attendue"),
    price: positiveNumber,
    currency: z.literal("EUR", { error: "devise non supportée (EUR attendu)" }),
    network: z.enum(["4G", "5G"], { error: "réseau inconnu" }),
    top_up: z.enum(["oui", "non"], { error: "top_up doit valoir oui/non" }),
  })
  .refine((r) => (r.data_gb === null) === (r.data_display === "Illimité"), {
    message: "data_gb vide uniquement pour les offres « Illimité »",
  });

export interface ParsedFile {
  products: Product[];
  rejected: RejectedRow[];
  rows: number;
}

/** Parses one supplier CSV. Invalid rows are reported, never silently kept. */
export function parseSupplierCsv(text: string, file: string): ParsedFile {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const missing = HEADER.filter((h) => !parsed.meta.fields?.includes(h));
  if (missing.length > 0) {
    return {
      products: [],
      rows: parsed.data.length,
      rejected: [{ file, line: 1, reason: `colonnes manquantes : ${missing.join(", ")}` }],
    };
  }

  const products: Product[] = [];
  const rejected: RejectedRow[] = [];
  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".") || "ligne"} : ${issue.message}`)
        .join(" ; ");
      rejected.push({ file, line, reason });
      return;
    }
    const r = result.data;
    products.push({
      sku: r.sku,
      provider: r.provider,
      name: r.product_name,
      countryCode: r.country_code,
      countryName: r.country_name,
      dataGb: r.data_gb,
      validityDays: r.validity_days,
      price: r.price,
      network: r.network,
      topUp: r.top_up === "oui",
    });
  });
  for (const e of parsed.errors) {
    rejected.push({ file, line: (e.row ?? 0) + 2, reason: `CSV mal formé : ${e.message}` });
  }
  return { products, rejected, rows: parsed.data.length };
}

export interface Catalog {
  products: Product[];
  quality: QualityReport;
}

/** Merges parsed supplier files and flags SKUs seen more than once. */
export function mergeCatalog(files: { file: string; text: string }[]): Catalog {
  const products: Product[] = [];
  const rejected: RejectedRow[] = [];
  const perFile: FileReport[] = [];
  const seen = new Set<string>();
  let rows = 0;
  for (const { file, text } of files) {
    const parsed = parseSupplierCsv(text, file);
    rows += parsed.rows;
    rejected.push(...parsed.rejected);
    let valid = 0;
    for (const p of parsed.products) {
      if (seen.has(p.sku)) {
        rejected.push({ file, line: 0, reason: `sku en double : ${p.sku}` });
        continue;
      }
      seen.add(p.sku);
      products.push(p);
      valid += 1;
    }
    perFile.push({ file, provider: parsed.products[0]?.provider ?? "?", rows: parsed.rows, valid });
  }
  return {
    products,
    quality: { files: files.length, rows, valid: products.length, rejected, perFile },
  };
}
