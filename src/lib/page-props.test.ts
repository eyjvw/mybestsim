import { describe, expect, test } from "bun:test";
import { dashboardProps, SITE_NAV } from "./page-props";

describe("dashboardProps", () => {
  test("build snapshot props for the dashboard islands", () => {
    const p = dashboardProps();
    expect(p.initialStats.total).toBe(5056);
    expect(p.initialRows).toHaveLength(15);
    expect(p.initialRows[0].price).toBe(5.36);
    expect(p.options.providers).toHaveLength(18);
    expect(p.initialAudit.duplicates).toHaveLength(219);
    expect(p.initialQuality.rejected).toEqual([]);
  });

  test("navigation lists every page once, home first", () => {
    const hrefs = SITE_NAV.map((n) => n.href);
    expect(hrefs[0]).toBe("/");
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual([
      "/",
      "/analyse",
      "/offres",
      "/qualite",
      "/import",
      "/blog/internet-croisiere-esim/",
    ]);
  });
});
