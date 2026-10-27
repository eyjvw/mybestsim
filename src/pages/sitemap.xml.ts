import type { APIRoute } from "astro";
import { BUILD } from "../lib/build-info";
import { buildSitemap, sitemapPages } from "../lib/sitemap";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("sitemap.xml needs `site` in astro.config");
  return new Response(buildSitemap(sitemapPages(BUILD.builtAt), site), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
