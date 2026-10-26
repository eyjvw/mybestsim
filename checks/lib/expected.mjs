// Independent oracle: recomputes catalog figures from raw CSV without app code.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function expectedFrom(dataDir) {
  const files = readdirSync(dataDir)
    .filter((f) => f.endsWith(".csv"))
    .sort();
  if (files.length === 0) throw new Error(`no csv in ${dataDir}`);
  const rows = [];
  for (const f of files) {
    const text = readFileSync(join(dataDir, f), "utf8").replace(/^﻿/, "");
    if (text.includes('"')) throw new Error(`quoted field in ${f}: naive split unsafe`);
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const header = lines.shift().split(",");
    for (const line of lines) {
      const cells = line.split(",");
      if (cells.length !== header.length) throw new Error(`bad width in ${f}: ${line}`);
      rows.push(Object.fromEntries(header.map((h, i) => [h, cells[i]])));
    }
  }
  const prices = rows.map((r) => Number(r.price));
  const finite = rows.filter((r) => r.data_gb !== "").map((r) => Number(r.data_gb));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const byProvider = {};
  for (const r of rows) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
  return {
    files: files.length,
    total: rows.length,
    over100: prices.filter((p) => p > 100).length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avgPrice: Math.round((sum(prices) / prices.length) * 100) / 100,
    avgDataGb: Math.round((sum(finite) / finite.length) * 100) / 100,
    unlimited: rows.length - finite.length,
    byProvider,
  };
}
