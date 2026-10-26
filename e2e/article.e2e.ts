import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

const ARTICLE = "/blog/internet-croisiere-esim/";

test.describe("part 2 article", () => {
  test("is in the navigation, marked as the current page, with no console error", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Pages" })
      .getByRole("link", { name: "Article" })
      .click();
    await expect(page).toHaveURL(/\/blog\/internet-croisiere-esim\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Internet en croisière : quelle eSIM choisir ?",
    );
    await expect(
      page.getByRole("navigation", { name: "Pages" }).getByRole("link", { name: "Article" }),
    ).toHaveAttribute("aria-current", "page");
    expect(errors).toEqual([]);
  });

  test("every table of contents entry jumps to its section", async ({ page }) => {
    await page.goto(ARTICLE);
    const entries = page.getByRole("navigation", { name: "Sommaire" }).getByRole("link");
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < count; i++) {
      const href = (await entries.nth(i).getAttribute("href")) ?? "";
      await expect(page.locator(href)).toHaveCount(1);
    }
    await entries.last().click();
    await expect(page).toHaveURL(/#faq$/);
    await expect(page.locator("#faq")).toBeInViewport();
  });

  test("FAQ answers open on demand and match the structured data", async ({ page }) => {
    await page.goto(ARTICLE);
    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    const faq = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    const first = page.locator("#faq + .faq details").first();
    await expect(first.locator("p")).toBeHidden();
    await first.locator("summary").click();
    await expect(first.locator("p")).toBeVisible();
    await expect(first.locator("summary")).toHaveText(faq.mainEntity[0].name);
  });

  test("has no serious accessibility violation in the dark theme", async ({ page }) => {
    await page.goto(ARTICLE);
    await page.getByRole("button", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });
});
