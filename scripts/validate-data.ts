// Schema gate for supplier CSVs: run in CI so a malformed import never reaches production.
import { loadCatalog } from "../src/lib/load";

const { quality } = loadCatalog();

console.log(
  `${quality.files} fichiers · ${quality.rows} lignes · ${quality.valid} valides · ${quality.rejected.length} rejetées`,
);

if (quality.files === 0) {
  console.error("Aucun CSV trouvé dans data/");
  process.exit(1);
}
if (quality.rejected.length > 0) {
  for (const r of quality.rejected) console.error(`  ${r.file}:${r.line} → ${r.reason}`);
  process.exit(1);
}
console.log("Données valides.");
