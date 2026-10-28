// Regenerates the README screenshots from a fresh live site (`bun run dev:live`): /import first,
// analysing the example file, then publishes the valid example through the API (with the token
// for production, anonymously for the sandbox) so the home page and /?bac=1 show "Depuis le
// dernier import", then the other pages and the article.
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
  { name: "opportunites", path: "/analyse", width: 1440, height: 1100, element: "#opportunities" },
  { name: "offres", path: "/offres", width: 1440, height: 1500 },
  { name: "qualite", path: "/qualite", width: 1440, height: 1500 },
  { name: "bac-a-sable", path: "/?bac=1", width: 1440, height: 1100 },
  { name: "article", path: "/blog/internet-croisiere-esim/", width: 1440, height: 1500 },
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
  const file = join(out, `${s.name}.png`);
  if (s.element) {
    // Below the sticky filter bar, which would cover the section title.
    await page.evaluate((sel) => {
      const top = document.querySelector(sel).getBoundingClientRect().top;
      window.scrollTo(0, window.scrollY + top - 180);
    }, s.element);
    await page.waitForTimeout(300);
    const box = await page.locator(s.element).boundingBox();
    const clip = { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 };
    await page.screenshot({ path: file, clip });
  } else await page.screenshot({ path: file });
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
  if (s.sample) {
    const csv = await (await fetch(`${base}/exemple-import-valide.csv`)).text();
    const r = await fetch(`${base}/api/sandbox/imports?file=airalo.csv`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csv,
    });
    console.log(`published the valid example to the sandbox: ${r.status}`);
  }
}
await browser.close();
