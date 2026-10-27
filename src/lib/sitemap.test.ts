import { describe, expect, test } from "bun:test";
import { ARTICLE } from "./cruise";
import { SITE_NAV } from "./page-props";
import { buildSitemap, canonicalPath, sitemapPages } from "./sitemap";

describe("buildSitemap", () => {
  const site = "https://mybestsim.sbonneau.xyz";

  test("lists each page as an absolute loc with its lastmod", () => {
    const xml = buildSitemap([{ path: "/blog/a/", lastmod: "2026-10-27" }], site);
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>\n');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(
      "<url><loc>https://mybestsim.sbonneau.xyz/blog/a/</loc><lastmod>2026-10-27</lastmod></url>",
    );
    expect(xml.trimEnd()).toEndWith("</urlset>");
  });

  test("escapes XML special characters in the URL", () => {
    const xml = buildSitemap([{ path: "/a?x=1&y=2", lastmod: "2026-10-27" }], site);
    expect(xml).toContain("<loc>https://mybestsim.sbonneau.xyz/a?x=1&amp;y=2</loc>");
  });
});

describe("sitemapPages", () => {
  const pages = sitemapPages("2026-11-02T08:30:00.000Z");

  test("indexes every page of the navigation, in its canonical form", () => {
    expect(pages.map((p) => p.path)).toEqual([
      "/",
      "/analyse/",
      "/offres/",
      "/qualite/",
      "/import/",
      "/blog/internet-croisiere-esim/",
    ]);
    expect(pages).toHaveLength(SITE_NAV.length);
  });

  test("dates the dashboard pages by the build and the article by its own update", () => {
    for (const p of pages) {
      expect(p.lastmod).toBe(p.path === ARTICLE.path ? ARTICLE.updated : "2026-11-02");
    }
  });

  test("canonicalPath adds the trailing slash once", () => {
    expect(canonicalPath("/offres")).toBe("/offres/");
    expect(canonicalPath("/offres/")).toBe("/offres/");
    expect(canonicalPath("/")).toBe("/");
  });
});
