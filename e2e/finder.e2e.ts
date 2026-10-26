import { expect, test } from "@playwright/test";
import { catalog, hydrated, type RawProduct } from "./helpers";

// Independent restatement of the finder rule: covers the whole trip, enough data, and for
// Italy the Europe and World plans count when regional plans are allowed.
const eligible = (products: RawProduct[], codes: string[], days: number, gb: number) =>
  products
    .filter((p) => codes.includes(p.countryCode) && p.validityDays >= days)
    .filter((p) => p.dataGb === null || p.dataGb >= gb)
    .sort((a, b) => a.price - b.price);

test.describe("trip finder", () => {
  test("default trip: cheapest offers covering Italy for 10 days with 5 Go", async ({
    page,
    request,
  }) => {
    const products = await catalog(request);
    await page.goto("/offres");
    await hydrated(page);
    const expected = eligible(products, ["IT", "EU", "WW"], 10, 5);
    const result = page.locator("[data-finder-result]");
    await expect(result.locator("[data-finder-eligible]")).toHaveAttribute(
      "data-finder-eligible",
      String(expected.length),
    );
    const first = result.locator("[data-finder-sku]").first();
    await expect(first).toHaveAttribute("data-finder-price", String(expected[0].price));
  });

  test("without regional plans only Italian offers remain", async ({ page, request }) => {
    const products = await catalog(request);
    await page.goto("/offres");
    await hydrated(page);
    await page.getByRole("checkbox", { name: /forfaits régionaux/ }).uncheck();
    const expected = eligible(products, ["IT"], 10, 5);
    await expect(page.locator("[data-finder-eligible]")).toHaveAttribute(
      "data-finder-eligible",
      String(expected.length),
    );
    for (const sku of await page
      .locator("[data-finder-sku]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-finder-sku")))) {
      expect(products.find((p) => p.sku === sku)?.countryCode).toBe("IT");
    }
  });

  test("usage profiles fill the data field and long trips get an explanation", async ({ page }) => {
    await page.goto("/offres");
    await hydrated(page);
    const form = page.locator("[data-finder-form]");
    await form.getByRole("button", { name: /Intensif/ }).click();
    // 10 days at 2.5 Go/day = 25 Go, rounded up to the 50 Go tier.
    await expect(form.locator('select[name="data"]')).toHaveValue("50");
    await form.locator('input[name="days"]').fill("45");
    await expect(page.locator("[data-finder-result]")).toContainText(
      "Aucune offre ne couvre ce séjour",
    );
  });
});
