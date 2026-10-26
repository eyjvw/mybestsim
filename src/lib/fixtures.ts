import type { Product } from "./types";

export const HEADER =
  "sku,provider,product_name,country_code,country_name,data_gb,data_display,validity_days,price,currency,network,top_up";

let seq = 0;

/** Builds a product with sensible defaults for unit tests. */
export function product(overrides: Partial<Product> = {}): Product {
  seq += 1;
  return {
    sku: `test-${seq}`,
    provider: "Airalo",
    name: "eSIM France 5 Go 7 jours",
    countryCode: "FR",
    countryName: "France",
    dataGb: 5,
    validityDays: 7,
    price: 10,
    network: "4G",
    topUp: true,
    ...overrides,
  };
}
