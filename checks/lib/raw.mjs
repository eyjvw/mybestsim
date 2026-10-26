// Independent reader for the oracles: plain split on raw CSV, no app code.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readRows(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  if (text.includes('"')) throw new Error(`quoted field in ${path}: naive split unsafe`);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines.shift().split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    if (cells.length !== header.length) throw new Error(`bad width in ${path}: ${line}`);
    const r = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    return {
      ...r,
      price: Number(r.price),
      gb: r.data_gb === "" ? Number.POSITIVE_INFINITY : Number(r.data_gb),
      days: Number(r.validity_days),
      valid: r.currency === "EUR" && /^\d+(\.\d+)?$/.test(r.price) && Number(r.price) > 0,
    };
  });
}

export function readDir(dir) {
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort()
    .flatMap((f) => readRows(join(dir, f)));
}

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function group(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
