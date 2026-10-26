import { type APIRequestContext, expect, type Page } from "@playwright/test";

/** Raw catalog as served to the browser. Tests recompute expectations from it with plain code. */
export interface RawProduct {
  sku: string;
  provider: string;
  name: string;
  countryCode: string;
  countryName: string;
  dataGb: number | null;
  validityDays: number;
  price: number;
  network: "4G" | "5G";
  topUp: boolean;
}

let cache: RawProduct[] | undefined;

export async function catalog(request: APIRequestContext): Promise<RawProduct[]> {
  if (!cache) {
    const res = await request.get("/catalog.json");
    expect(res.ok()).toBe(true);
    cache = ((await res.json()) as { products: RawProduct[] }).products;
  }
  return cache;
}

/** Collects console errors and uncaught exceptions for the whole test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/** Waits until the island has fetched the catalog (filters become enabled). */
export async function hydrated(page: Page) {
  await expect(page.locator("#filter-controls select").first()).toBeEnabled({ timeout: 15_000 });
}

export async function kpi(page: Page, id: string): Promise<number> {
  const v = await page.locator(`[data-kpi="${id}"]`).first().getAttribute("data-value");
  return Number(v);
}

/** Page width beyond the viewport, in CSS pixels (0 = no horizontal scroll). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
