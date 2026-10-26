import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_TOKEN } from "../playwright.config";
import { hydrated } from "./helpers";

// Runs against the ingest service: the build is never touched, only the data volume.
test.describe.configure({ mode: "serial" });

test.describe("live data, no rebuild", () => {
  let buildSha = "";

  test("the dashboard reads the live release", async ({ page, request }) => {
    buildSha = (await (await request.get("/version.json")).json()).sha;
    await page.goto("/");
    await hydrated(page);
    await expect(page.locator('[data-source="live"]')).toContainText("Données en direct");
    await expect(page.locator("#changes")).toHaveCount(0); // seed release: nothing to compare yet
  });

  test("an invalid file cannot be published", async ({ page }) => {
    await page.goto("/import");
    await page.getByRole("button", { name: "Analyser l'exemple" }).click();
    await expect(page.locator("[data-publish-form]")).toBeVisible();
    await expect(page.getByText("Corrigez d'abord les lignes rejetées")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier" })).toBeDisabled();
  });

  test("a wrong token is refused and nothing changes", async ({ page, request }) => {
    const before = (await (await request.get("/data/version.json")).json()).importId;
    await page.goto("/import");
    await page.getByRole("button", { name: "Exemple sans erreur" }).click();
    await page.locator('input[name="token"]').fill("wrong");
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.locator("[data-publish-result]")).toContainText(
      "Jeton de publication manquant ou invalide",
    );
    expect((await (await request.get("/data/version.json")).json()).importId).toBe(before);
  });

  test("publishing a file updates the dashboard and its changes, without rebuild", async ({
    page,
    request,
  }) => {
    const before = await (await request.get("/data/catalog.json")).json();
    const sample = await (await request.get("/exemple-import-valide.csv")).text();
    const rows = sample
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => l.split(",")[0]);
    const today = new Set(
      before.products
        .filter((p: { provider: string }) => p.provider === "Airalo")
        .map((p: { sku: string }) => p.sku),
    );
    const added = rows.filter((sku) => !today.has(sku)).length;
    const removed = [...today].filter((sku) => !rows.includes(sku as string)).length;

    await page.goto("/import");
    await page.getByRole("button", { name: "Exemple sans erreur" }).click();
    await page.locator('input[name="token"]').fill(E2E_TOKEN);
    await page.getByRole("button", { name: "Publier" }).click();
    const result = page.locator('[data-publish-result="published"]');
    await expect(result).toContainText("Publié");
    const importId = (await result.locator("code").textContent()) ?? "";

    const version = await (await request.get("/data/version.json")).json();
    expect(version).toMatchObject({ importId, source: "api" });
    expect((await (await request.get("/version.json")).json()).sha).toBe(buildSha);

    await page.goto("/");
    await hydrated(page);
    await expect(page.locator('[data-kpi="total"]')).toHaveAttribute(
      "data-value",
      String(before.products.length + added - removed),
    );
    const changes = page.locator(`[data-changes="${importId}"]`);
    await expect(changes).toBeVisible();
    await expect(changes.getByText("nouvelles offres").locator("..")).toContainText(String(added));
    await expect(changes.getByText("offres retirées").locator("..")).toContainText(String(removed));
    await expect(page.locator("[data-change-moves] li")).toHaveCount(6);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("an abnormal file is held by the guard until a human forces it", async ({
    page,
    request,
  }) => {
    const cat = await (await request.get("/data/catalog.json")).json();
    const own = cat.products.filter((p: { provider: string }) => p.provider === "Roamic");
    const doubled = [
      "sku,provider,product_name,country_code,country_name,data_gb,data_display,validity_days,price,currency,network,top_up",
      ...own.map((p: Record<string, unknown>) =>
        [
          p.sku,
          p.provider,
          p.name,
          p.countryCode,
          p.countryName,
          p.dataGb ?? "",
          p.dataGb === null ? "Illimité" : `${p.dataGb} Go`,
          p.validityDays,
          Math.round((p.price as number) * 200) / 100,
          "EUR",
          p.network,
          p.topUp ? "oui" : "non",
        ].join(","),
      ),
    ].join("\n");
    const before = (await (await request.get("/data/version.json")).json()).importId;
    await page.goto("/import");
    await expect(page.locator("[data-import-input]")).toBeEnabled();
    await page
      .locator("[data-import-input]")
      .setInputFiles({ name: "roamic.csv", mimeType: "text/csv", buffer: Buffer.from(doubled) });
    await page.locator('input[name="token"]').fill(E2E_TOKEN);
    await expect(page.getByRole("button", { name: "Publier" })).toBeDisabled();
    await expect(page.getByText(/Le garde-fou retient ce fichier \(Roamic/)).toBeVisible();
    // Through the API directly, the server holds it too.
    const res = await request.post("/api/imports", {
      headers: { Authorization: `Bearer ${E2E_TOKEN}` },
      multipart: {
        file: { name: "roamic.csv", mimeType: "text/csv", buffer: Buffer.from(doubled) },
      },
    });
    expect(res.status()).toBe(409);
    expect((await (await request.get("/data/version.json")).json()).importId).toBe(before);
  });
});
