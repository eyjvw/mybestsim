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

    for (const path of ["/analyse", "/offres", "/qualite", "/blog/internet-croisiere-esim/"]) {
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

  test("on a phone the six brief items are visible without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page).catch(() => {});
    for (const kpi of ["total", "over100", "price-min", "price-max", "avg-data", "avg-price"]) {
      const box = await page.locator(`[data-kpi="${kpi}"]`).first().boundingBox();
      expect(box, kpi).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0), kpi).toBeLessThanOrEqual(844);
    }
    // Item 6: the provider count, with a link to the full breakdown further down.
    const providers = page.locator('[data-kpi="providers"]');
    const box = await providers.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
    await expect(providers).toHaveAttribute(
      "data-value",
      String(await page.locator("#providers li").count()),
    );
  });

  test("on a phone the whole navigation fits on one line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Pages" });
    const overflow = await nav.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBe(0);
    await expect(nav.getByRole("link", { name: "Article" })).toBeInViewport({ ratio: 1 });
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

  test("on a phone a tap shows a histogram column's count inside the chart, a second tap hides it", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto("/");
    await hydrated(page);
    const columns = page.locator("#prices [data-bin]");
    const tip = page.locator("#prices [data-histogram-tip]");
    const chart = await page.locator("#prices figure").boundingBox();
    for (const i of [0, 7, (await columns.count()) - 1]) {
      await columns.nth(i).tap();
      await expect(tip).toHaveAttribute("data-histogram-tip", String(i));
      const box = await tip.boundingBox();
      expect(box && chart && box.x >= chart.x && box.x + box.width <= chart.x + chart.width).toBe(
        true,
      );
    }
    await columns.last().tap();
    await expect(tip).toHaveCount(0);
    await columns.nth(3).tap();
    await page.locator("h1").tap();
    await expect(tip).toHaveCount(0);
    await ctx.close();
  });
});
