import { describe, expect, test } from "bun:test";
import { buildSitemap, INDEXED_PAGES } from "./sitemap";

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

  test("indexes only the article, never a dashboard page", () => {
    expect(INDEXED_PAGES.map((p) => p.path)).toEqual(["/blog/internet-croisiere-esim/"]);
    for (const p of INDEXED_PAGES) expect(p.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
