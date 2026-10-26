import { describe, expect, test } from "bun:test";
import { isRegion, REGION_MEMBERS, regionsCovering } from "./regions";

describe("regions", () => {
  test("recognises the four pseudo-codes only", () => {
    expect(["EU", "AS", "NA", "WW"].every(isRegion)).toBe(true);
    // AS is not American Samoa and NA is not Namibia in these files.
    expect(isRegion("FR")).toBe(false);
  });

  test("lists the regional plans covering a destination, world last", () => {
    expect(regionsCovering("FR")).toEqual(["EU", "WW"]);
    expect(regionsCovering("JP")).toEqual(["AS", "WW"]);
    expect(regionsCovering("US")).toEqual(["NA", "WW"]);
    expect(regionsCovering("MA")).toEqual(["WW"]);
    expect(regionsCovering("EU")).toEqual(["WW"]);
    expect(regionsCovering("WW")).toEqual([]);
  });

  test("no country belongs to two regions", () => {
    const all = Object.values(REGION_MEMBERS).flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });
});
