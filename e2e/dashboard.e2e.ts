import { expect, test } from "@playwright/test";
import { catalog, hydrated, kpi, trackErrors } from "./helpers";

test.describe("dashboard", () => {
  test("the six brief KPIs are in the HTML before any JavaScript runs", async ({
    browser,
    request,
  }) => {
    const products = await catalog(request);
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    const prices = products.map((p) => p.price);
    expect(await kpi(page, "total")).toBe(products.length);
    expect(await kpi(page, "over100")).toBe(prices.filter((p) => p > 100).length);
    expect(await kpi(page, "price-min")).toBe(Math.min(...prices));
    expect(await kpi(page, "price-max")).toBe(Math.max(...prices));
    await expect(page.locator("#providers li")).toHaveCount(
      new Set(products.map((p) => p.provider)).size,
    );
    await ctx.close();
  });

  test("filters recompute KPIs and are written to the URL", async ({ page, request }) => {
    const products = await catalog(request);
    const errors = trackErrors(page);
    await page.goto("/");
    await hydrated(page);
    await page.locator("#filter-controls select").first().selectOption("Holafly");
    await page.getByRole("button", { name: "5G", exact: true }).click();
    const expected = products.filter((p) => p.provider === "Holafly" && p.network === "5G");
    await expect(page.locator('[data-kpi="total"]')).toHaveAttribute(
      "data-value",
      String(expected.length),
    );
    const over100 = expected.filter((p) => p.price > 100).length;
    expect(await kpi(page, "over100")).toBe(over100);
    await expect(page).toHaveURL(/fournisseur=Holafly/);
    await expect(page).toHaveURL(/reseau=5G/);
    expect(errors).toEqual([]);
  });

  test("a shared URL reopens the same filtered view", async ({ page, request }) => {
    const products = await catalog(request);
    await page.goto("/?destination=JP&duree=30&data=unlimited");
    await hydrated(page);
    const expected = products.filter(
      (p) => p.countryCode === "JP" && p.validityDays === 30 && p.dataGb === null,
    );
    await expect(page.locator('[data-kpi="total"]')).toHaveAttribute(
      "data-value",
      String(expected.length),
    );
    await page
      .getByRole("button", { name: /Réinitialiser/ })
      .last()
      .click();
    await expect(page.locator('[data-kpi="total"]')).toHaveAttribute(
      "data-value",
      String(products.length),
    );
    await expect(page).not.toHaveURL(/destination=/);
  });

  test("invalid URL values are ignored instead of emptying the page", async ({ page, request }) => {
    const products = await catalog(request);
    await page.goto("/?fournisseur=Nope&reseau=3G");
    await hydrated(page);
    await expect(page.locator('[data-kpi="total"]')).toHaveAttribute(
      "data-value",
      String(products.length),
    );
  });

  test("insights follow the selection", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    const cards = page.locator("[data-insight]");
    await expect(cards).toHaveCount(3);
    const before = await cards.allTextContents();
    await page.locator("#filter-controls select").first().selectOption("Airalo");
    await expect.poll(async () => (await cards.allTextContents()).join()).not.toBe(before.join());
  });

  test("the price histogram counts the offers over 100 € like KPI 2, filters included", async ({
    page,
    request,
  }) => {
    const products = await catalog(request);
    await page.goto("/");
    const histogram = page.locator("[data-price-histogram]");
    await expect(histogram).toHaveAttribute("data-threshold", "100");
    await expect(histogram).toHaveAttribute(
      "data-over",
      String(products.filter((p) => p.price > 100).length),
    );
    await hydrated(page);
    await page.locator("#filter-controls select").first().selectOption("aloSIM");
    const expected = products.filter((p) => p.provider === "aloSIM" && p.price > 100).length;
    await expect(histogram).toHaveAttribute("data-over", String(expected));
    expect(await kpi(page, "over100")).toBe(expected);
  });

  test("each provider of the breakdown shows its logo, loaded, and Truphone its initial", async ({
    page,
    request,
  }) => {
    const providers = new Set((await catalog(request)).map((p) => p.provider));
    await page.goto("/");
    await hydrated(page);
    const rows = page.locator("#providers li");
    await expect(rows).toHaveCount(providers.size);
    for (const row of await rows.all()) {
      const name = (await row.locator("[data-bar-label]").textContent()) ?? "";
      const logo = row.locator("[data-logo]");
      await expect(logo).toHaveAttribute("data-logo", name);
      if (name === "Truphone") {
        await expect(logo).toHaveAttribute("data-initials", "T");
        continue;
      }
      await logo.scrollIntoViewIfNeeded();
      await expect(logo).toHaveAttribute("alt", "");
      await expect
        .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
        .toBe(64);
    }
  });

  test("opportunities rank destinations by price gap and follow the filters", async ({ page }) => {
    await page.goto("/analyse");
    await hydrated(page);
    const gaps = page.locator("[data-opportunity-gaps] li");
    await expect(gaps).toHaveCount(8);
    const values = await gaps.evaluateAll((lis) => lis.map((li) => Number(li.dataset.gap)));
    expect(values).toEqual([...values].sort((a, b) => b - a));
    await expect(gaps.locator('[data-mybestsim-link^="https://mybestsim.com/fr/"]')).toHaveCount(8);
    await page.goto("/analyse?destination=IT");
    await hydrated(page);
    await expect(gaps).toHaveCount(1);
    await expect(gaps.first()).toHaveAttribute("data-opportunity", "IT");
  });

  test("offer rows carry the logo of their provider", async ({ page }) => {
    await page.goto("/offres?fournisseur=Ubigi");
    await hydrated(page);
    const cells = page.locator("#products table tbody tr td:nth-child(2) img");
    await expect(cells.first()).toHaveAttribute("src", "/logos/ubigi.webp");
    const srcs = await cells.evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")));
    expect(srcs.length).toBeGreaterThan(0);
    expect(new Set(srcs)).toEqual(new Set(["/logos/ubigi.webp"]));
  });

  test("table search ignores accents and sorting puts the dearest first", async ({
    page,
    request,
  }) => {
    const products = await catalog(request);
    await page.goto("/offres");
    await hydrated(page);
    const search = page.getByRole("searchbox", { name: "Rechercher une offre" });
    await search.fill("etats-unis");
    const expected = products.filter((p) => p.countryName === "États-Unis").length;
    await expect(page.locator("[data-results]")).toHaveAttribute("data-results", String(expected));
    await search.fill("");
    await page.getByRole("button", { name: /^Prix/ }).click();
    const firstPrice = page.locator("#products table tbody tr").first().locator("td").nth(5);
    const max = Math.max(...products.map((p) => p.price));
    await expect(firstPrice).toHaveText(new RegExp(max.toFixed(2).replace(".", ",")));
  });

  test("CSV export contains exactly the filtered offers in the supplier format", async ({
    page,
    request,
  }) => {
    const products = await catalog(request);
    await page.goto("/offres?fournisseur=Yesim");
    await hydrated(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exporter en CSV" }).click(),
    ]);
    const text = await (await download.createReadStream())
      .toArray()
      .then((c) => Buffer.concat(c).toString("utf8"));
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe(
      "sku,provider,product_name,country_code,country_name,data_gb,data_display,validity_days,price,currency,network,top_up",
    );
    const expected = products.filter((p) => p.provider === "Yesim");
    expect(lines).toHaveLength(expected.length + 1);
    expect(new Set(lines.slice(1).map((l) => l.split(",")[0]))).toEqual(
      new Set(expected.map((p) => p.sku)),
    );
  });

  test("the quality section reports the business checks from stats.json", async ({
    page,
    request,
  }) => {
    const stats = await (await request.get("/stats.json")).json();
    await page.goto("/qualite");
    await expect(page.locator('[data-audit="duplicates"]')).toHaveAttribute(
      "data-count",
      String(stats.audit.duplicates.groups),
    );
    await expect(page.locator('[data-audit="outliers"]')).toHaveAttribute(
      "data-count",
      String(stats.audit.outliers.length),
    );
    await expect(page.locator('[data-audit="dominated"]')).toHaveAttribute(
      "data-count",
      String(stats.audit.dominatedWithinProvider),
    );
  });

  test("light by default, even when the OS prefers dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    const bg = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(bg).toBe("rgb(246, 249, 253)");
    await expect(page.getByRole("button", { name: "Clair" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("theme choice applies, persists across reloads and can follow the system", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Sombre" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByRole("button", { name: "Système" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await page.getByRole("button", { name: "Clair" }).click();
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("filters follow the visitor from page to page", async ({ page, request }) => {
    const products = await catalog(request);
    await page.goto("/");
    await hydrated(page);
    await page.locator("#filter-controls select").first().selectOption("Holafly");
    await expect(page).toHaveURL(/fournisseur=Holafly/);
    await page
      .getByRole("navigation", { name: "Pages" })
      .getByRole("link", { name: "Analyse" })
      .click();
    await expect(page).toHaveURL(/\/analyse\?fournisseur=Holafly/);
    await hydrated(page);
    await expect(page.locator("#filter-controls select").first()).toHaveValue("Holafly");
    const expected = products.filter((p) => p.provider === "Holafly").length;
    await expect(page.locator("[data-shown]").first()).toHaveAttribute(
      "data-shown",
      String(expected),
    );
    await page.locator('[aria-label="Pages"] a[href^="/offres"]').click();
    await expect(page).toHaveURL(/\/offres\?fournisseur=Holafly/);
    await expect(page.locator("[data-results]")).toHaveAttribute("data-results", String(expected));
  });

  test("the home page links to every sub-page with its key figure", async ({ page }) => {
    await page.goto("/");
    for (const href of ["/analyse", "/offres", "/qualite"]) {
      await expect(page.locator(`[data-explore="${href}"]`)).toBeVisible();
    }
    await page.locator('[data-explore="/qualite"]').click();
    await expect(page).toHaveURL(/\/qualite$/);
    await expect(page.locator("#quality")).toBeVisible();
    await expect(page.locator("#decisions")).toBeVisible();
  });

  test("clickable controls show the hand cursor, disabled ones do not", async ({ page }) => {
    await page.goto("/offres");
    await hydrated(page);
    const cursor = (loc: import("@playwright/test").Locator) =>
      loc.evaluate((el) => getComputedStyle(el).cursor);
    expect(await cursor(page.getByRole("button", { name: "Suivant →" }))).toBe("pointer");
    expect(await cursor(page.getByRole("button", { name: "← Précédent" }))).toBe("not-allowed");
    expect(await cursor(page.getByRole("button", { name: "Exporter en CSV" }))).toBe("pointer");
    expect(await cursor(page.locator("#filter-controls select").first())).toBe("pointer");
  });
});
