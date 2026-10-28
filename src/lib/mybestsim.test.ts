import { describe, expect, test } from "bun:test";
import { loadCatalog } from "./load";
import { MYBESTSIM_PAGES, mybestsimUrl } from "./mybestsim";

describe("mybestsim.com pages", () => {
  test("every destination of the catalog has its page", () => {
    const codes = new Set(loadCatalog().products.map((p) => p.countryCode));
    expect([...codes].filter((c) => !MYBESTSIM_PAGES[c])).toEqual([]);
    expect(Object.keys(MYBESTSIM_PAGES)).toHaveLength(codes.size);
  });

  test("three destinations moved off the comparaison-… pattern", () => {
    const moved = Object.entries(MYBESTSIM_PAGES)
      .filter(([, path]) => !path.startsWith("comparaison-meilleure-carte-esim-"))
      .map(([code]) => code);
    expect(moved).toEqual(["GB", "MA", "TH"]);
  });

  test("builds the address, and none for a destination it does not know", () => {
    expect(mybestsimUrl("CZ")).toBe(
      "https://mybestsim.com/fr/comparaison-meilleure-carte-esim-republique-tcheque/",
    );
    expect(mybestsimUrl("MA")).toBe("https://mybestsim.com/fr/meilleure-carte-esim-maroc/");
    expect(mybestsimUrl("ZZ")).toBeNull();
  });
});
