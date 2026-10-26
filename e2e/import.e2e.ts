import { expect, test } from "@playwright/test";
import { catalog, trackErrors } from "./helpers";

test.describe("import preview", () => {
  test("the sample file is analysed against the live catalog", async ({ page, request }) => {
    const products = await catalog(request);
    const sample = await (await request.get("/exemple-import.csv")).text();
    // Independent diff by SKU on the raw text.
    const rows = sample
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => l.split(","));
    const valid = rows.filter((c) => c[9] === "EUR" && Number(c[8]) > 0);
    const today = new Map(products.filter((p) => p.provider === "Airalo").map((p) => [p.sku, p]));
    const added = valid.filter((c) => !today.has(c[0])).length;
    const removed = [...today.keys()].filter((sku) => !valid.some((c) => c[0] === sku)).length;
    const repriced = valid.filter(
      (c) => today.has(c[0]) && today.get(c[0])?.price !== Number(c[8]),
    ).length;

    const errors = trackErrors(page);
    await page.goto("/import");
    await page.getByRole("button", { name: "Analyser l'exemple" }).click();
    const result = page.locator("[data-import-result]");
    await expect(result).toBeVisible();
    await expect(page.locator("[data-import-rejected] li")).toHaveCount(rows.length - valid.length);
    await expect(result.getByText("nouvelles offres").locator("..")).toContainText(String(added));
    await expect(result.getByText("offres retirées").locator("..")).toContainText(String(removed));
    await expect(result.getByText("prix modifiés", { exact: true }).locator("..")).toContainText(
      String(repriced),
    );
    await expect(page.locator("[data-import-repriced] li")).toHaveCount(repriced);
    expect(errors).toEqual([]);
  });

  test("a dashboard export re-imports with no rejection and no change", async ({
    page,
    request,
  }) => {
    const products = await catalog(request);
    const own = products.filter((p) => p.provider === "Roamic");
    const csv = [
      "sku,provider,product_name,country_code,country_name,data_gb,data_display,validity_days,price,currency,network,top_up",
      ...own.map((p) =>
        [
          p.sku,
          p.provider,
          p.name,
          p.countryCode,
          p.countryName,
          p.dataGb ?? "",
          p.dataGb === null ? "Illimité" : `${p.dataGb} Go`,
          p.validityDays,
          p.price,
          "EUR",
          p.network,
          p.topUp ? "oui" : "non",
        ].join(","),
      ),
    ].join("\n");
    await page.goto("/import");
    await expect(page.locator("[data-import-input]")).toBeEnabled();
    await page
      .locator("[data-import-input]")
      .setInputFiles({ name: "roamic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    const result = page.locator("[data-import-result]");
    await expect(result).toContainText(`${own.length} lignes`);
    await expect(result).toContainText("Aucune : le fichier respecte le schéma.");
    await expect(result).toContainText("Aucun prix modifié.");
  });

  test("a non-CSV file is refused with a message", async ({ page }) => {
    await page.goto("/import");
    await expect(page.locator("[data-import-input]")).toBeEnabled();
    await page
      .locator("[data-import-input]")
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert")).toContainText(".csv");
  });
});
