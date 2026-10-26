import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

const blocking = (
  violations: { impact?: string | null; id: string; nodes: { target: unknown }[] }[],
) =>
  violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => JSON.stringify(n.target))
          .slice(0, 3)
          .join(", ")}`,
    );

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`dashboard has no serious violation in ${scheme} mode`, async ({ page }) => {
      await page.goto("/");
      await hydrated(page);
      if (scheme === "dark") {
        await page.getByRole("button", { name: "Sombre" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      }
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(blocking(r.violations)).toEqual([]);
    });
  }

  for (const path of ["/analyse", "/offres", "/qualite", "/blog/internet-croisiere-esim/"]) {
    test(`${path} has no serious violation`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(blocking(r.violations)).toEqual([]);
    });
  }

  test("import page with a result has no serious violation, in both themes", async ({ page }) => {
    await page.goto("/import");
    await page.getByRole("button", { name: "Analyser l'exemple" }).click();
    await expect(page.locator("[data-import-result]")).toBeVisible();
    const light = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(blocking(light.violations)).toEqual([]);
    await page.getByRole("button", { name: "Sombre" }).click();
    const dark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(blocking(dark.violations)).toEqual([]);
  });

  test("phone layout with the filter panel open has no serious violation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page).catch(() => {});
    await page.getByRole("button", { name: /^Filtres/ }).click();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(blocking(r.violations)).toEqual([]);
  });
});
