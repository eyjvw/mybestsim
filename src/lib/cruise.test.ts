import { describe, expect, test } from "bun:test";
import { cheapestPlan, fits, ITINERARIES, planCount, roamingCost } from "./cruise";
import { loadCatalog } from "./load";
import type { Product } from "./types";

const offer = (over: Partial<Product>): Product => ({
  sku: "x-1",
  provider: "P",
  name: "eSIM",
  countryCode: "EU",
  countryName: "Europe",
  dataGb: 5,
  validityDays: 7,
  price: 10,
  network: "4G",
  topUp: false,
  ...over,
});

const need = { codes: ["EU"], minGb: 5, minDays: 7 };

describe("fits", () => {
  test("needs the destination, enough data and enough validity; unlimited always has enough data", () => {
    expect(fits(offer({}), need)).toBe(true);
    expect(fits(offer({ countryCode: "IT" }), need)).toBe(false);
    expect(fits(offer({ dataGb: 3 }), need)).toBe(false);
    expect(fits(offer({ validityDays: 5 }), need)).toBe(false);
    expect(fits(offer({ dataGb: null }), need)).toBe(true);
  });
});

describe("cheapestPlan", () => {
  test("picks the lowest price among the offers that fit", () => {
    const pick = cheapestPlan(
      [
        offer({ sku: "a", price: 12 }),
        offer({ sku: "b", price: 4, dataGb: 1 }),
        offer({ sku: "c", price: 9 }),
        offer({ sku: "d", price: 3, countryCode: "AS" }),
      ],
      need,
    );
    expect(pick?.sku).toBe("c");
  });

  test("breaks ties with more data, then the shorter validity, then the SKU", () => {
    const same = { price: 10 };
    expect(
      cheapestPlan([offer({ sku: "a", ...same }), offer({ sku: "b", ...same, dataGb: null })], need)
        ?.sku,
    ).toBe("b");
    expect(
      cheapestPlan(
        [offer({ sku: "a", ...same, validityDays: 30 }), offer({ sku: "b", ...same })],
        need,
      )?.sku,
    ).toBe("b");
    expect(
      cheapestPlan([offer({ sku: "b", ...same }), offer({ sku: "a", ...same })], need)?.sku,
    ).toBe("a");
  });

  test("returns null when nothing fits", () => {
    expect(cheapestPlan([offer({ dataGb: 1 })], need)).toBeNull();
    expect(planCount([offer({ dataGb: 1 }), offer({})], need)).toBe(1);
  });
});

describe("itineraries on the real catalogue", () => {
  const { products } = loadCatalog();

  test("every itinerary of the article has a plan in the catalogue", () => {
    for (const it of ITINERARIES) {
      const pick = cheapestPlan(products, it.need);
      expect(pick, it.id).not.toBeNull();
      expect(planCount(products, it.need), it.id).toBeGreaterThan(1);
    }
  });

  test("ids are unique and every comparison page is on mybestsim.com", () => {
    expect(new Set(ITINERARIES.map((i) => i.id)).size).toBe(ITINERARIES.length);
    for (const it of ITINERARIES) expect(it.page).toStartWith("https://mybestsim.com/fr/");
  });
});

describe("roamingCost", () => {
  test("multiplies and rounds to the euro", () => {
    expect(roamingCost(100, 9.7)).toBe(970);
    expect(roamingCost(100, 15.84)).toBe(1584);
    expect(roamingCost(1, 0.4)).toBe(0);
  });
});
