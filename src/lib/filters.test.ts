import { describe, expect, test } from "bun:test";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  type FilterDomain,
  type Filters,
  filterOptions,
  filtersFromSearch,
  filtersToSearch,
} from "./filters";
import { product } from "./fixtures";
import { computeStats } from "./stats";

const catalog = [
  product({
    provider: "Airalo",
    countryCode: "FR",
    network: "4G",
    validityDays: 7,
    dataGb: 5,
    topUp: true,
    price: 10,
  }),
  product({
    provider: "Airalo",
    countryCode: "EU",
    network: "5G",
    validityDays: 30,
    dataGb: null,
    topUp: false,
    price: 120,
  }),
  product({
    provider: "Holafly",
    countryCode: "JP",
    network: "5G",
    validityDays: 15,
    dataGb: 20,
    topUp: true,
    price: 30,
  }),
  product({
    provider: "Holafly",
    countryCode: "WW",
    network: "4G",
    validityDays: 30,
    dataGb: 5,
    topUp: false,
    price: 25,
  }),
];

const run = (f: Partial<Filters>) => applyFilters(catalog, { ...DEFAULT_FILTERS, ...f });

describe("applyFilters", () => {
  test("default filters keep everything", () => {
    expect(run({})).toHaveLength(4);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  test.each<[string, Partial<Filters>, number]>([
    ["provider", { provider: "Holafly" }, 2],
    ["zone country", { zone: "country" }, 2],
    ["zone region", { zone: "region" }, 2],
    ["destination", { destination: "JP" }, 1],
    ["network", { network: "5G" }, 2],
    ["validity", { validity: 30 }, 2],
    ["data tier", { data: 5 }, 2],
    ["unlimited data", { data: "unlimited" }, 1],
    ["top-up yes", { topUp: "yes" }, 2],
    ["top-up no", { topUp: "no" }, 2],
  ])("filters by %s", (_, f, expected) => {
    expect(run(f)).toHaveLength(expected);
  });

  test("combines dimensions with AND and counts active filters", () => {
    const f = { ...DEFAULT_FILTERS, provider: "Holafly", network: "4G" as const };
    expect(applyFilters(catalog, f)).toHaveLength(1);
    expect(activeFilterCount(f)).toBe(2);
  });

  test("stats follow the filtered subset", () => {
    const s = computeStats(run({ provider: "Airalo" }));
    expect(s.total).toBe(2);
    expect(s.over100.count).toBe(1);
    expect(s.data).toEqual({ avgGb: 5, finiteCount: 1, unlimited: 1 });
    expect(s.price.avg).toBe(65);
  });
});

describe("filters in the URL", () => {
  const domain: FilterDomain = {
    providers: ["Airalo", "Holafly"],
    destinations: ["FR", "JP", "EU"],
    validities: [7, 15, 30],
    dataTiers: [1, 5, 20, null],
  };

  test("default filters give an empty query string", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
    expect(filtersFromSearch("", domain)).toEqual(DEFAULT_FILTERS);
  });

  test("round-trips every filter", () => {
    const f: Filters = {
      provider: "Holafly",
      zone: "country",
      destination: "JP",
      network: "5G",
      validity: 15,
      data: 20,
      topUp: "yes",
    };
    const search = filtersToSearch(f);
    expect(search).toBe(
      "?fournisseur=Holafly&zone=country&destination=JP&reseau=5G&duree=15&data=20&recharge=yes",
    );
    expect(filtersFromSearch(search, domain)).toEqual(f);
    expect(filtersFromSearch("?data=unlimited", domain).data).toBe("unlimited");
  });

  test("ignores unknown or invalid values", () => {
    const f = filtersFromSearch(
      "?fournisseur=Nope&zone=moon&destination=XX&reseau=3G&duree=9&data=7&recharge=maybe",
      domain,
    );
    expect(f).toEqual(DEFAULT_FILTERS);
  });

  test("drops a destination outside the chosen zone", () => {
    expect(filtersFromSearch("?zone=country&destination=EU", domain).destination).toBe("all");
    expect(filtersFromSearch("?zone=region&destination=EU", domain).destination).toBe("EU");
  });
});

describe("filterOptions", () => {
  test("providers and destinations of the catalog, sorted in French, regions flagged", () => {
    const o = filterOptions(catalog);
    expect(o.providers).toEqual(["Airalo", "Holafly"]);
    expect(o.destinations.map((d) => [d.code, d.region])).toEqual([
      ["EU", true],
      ["FR", false],
      ["JP", false],
      ["WW", true],
    ]);
  });
});
