// Regenerates the README screenshots from a fresh live site (`bun run dev:live`): /import first,
// analysing the example file, then, with a token, publishes the valid example through the API so
// the home page shows "Depuis le dernier import", then the other pages.
// Usage: node scripts/screenshots.mjs <base-url> [publish-token] [out-dir=docs/screenshots]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [base, token, out = "docs/screenshots"] = process.argv.slice(2);
if (!base) {
  console.error("usage: node scripts/screenshots.mjs <base-url> [publish-token] [out-dir]");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const shots = [
  { name: "import", path: "/import", width: 1440, height: 1500, sample: true },
  { name: "accueil", path: "/", width: 1440, height: 1500 },
  { name: "accueil-sombre", path: "/", width: 1440, height: 1500, dark: true },
  { name: "accueil-mobile", path: "/", width: 390, height: 1200 },
  { name: "analyse", path: "/analyse", width: 1440, height: 1700 },
  { name: "offres", path: "/offres", width: 1440, height: 1500 },
  { name: "qualite", path: "/qualite", width: 1440, height: 1500 },
];
const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  if (s.dark) await page.addInitScript(() => localStorage.setItem("mbs-theme", "dark"));
  await page.goto(base + s.path);
  await page.waitForLoadState("networkidle");
  if (s.sample) {
    await page.getByRole("button", { name: "Analyser l'exemple" }).click();
    await page.locator("[data-import-result]").waitFor();
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `${s.name}.png`) });
  await page.close();
  console.log(`${out}/${s.name}.png`);
  if (s.sample && token) {
    const csv = await (await fetch(`${base}/exemple-import-valide.csv`)).text();
    const r = await fetch(`${base}/api/imports?file=airalo.csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/csv" },
      body: csv,
    });
    console.log(`published the valid example: ${r.status}`);
  }
}
await browser.close();
