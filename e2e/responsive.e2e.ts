import { expect, test } from "@playwright/test";
import { horizontalOverflow, hydrated } from "./helpers";

const WIDTHS = [360, 390, 768, 1024, 1440];

test.describe("responsive layout", () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow on / at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await hydrated(page).catch(() => {});
      // Open the mobile filter panel too: it must fit as well.
      const toggle = page.getByRole("button", { name: /^Filtres/ });
      if (await toggle.isVisible()) await toggle.click();
      expect(await horizontalOverflow(page)).toBe(0);
    });

    for (const path of ["/analyse", "/offres", "/qualite"]) {
      test(`no horizontal overflow on ${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await horizontalOverflow(page)).toBe(0);
      });
    }

    test(`no horizontal overflow on /import at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/import");
      await page.getByRole("button", { name: "Analyser l'exemple" }).click();
      await expect(page.locator("[data-import-result]")).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }

  test("on a phone the first KPI is visible without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const box = await page.locator('[data-kpi="total"]').first().boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(844);
  });

  test("on a phone the filters open on demand", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page).catch(() => {});
    const toggle = page.getByRole("button", { name: /^Filtres/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#filter-controls")).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#filter-controls")).toBeVisible();
  });
});
