import type { APIRoute } from "astro";
import { buildSitemap, INDEXED_PAGES } from "../lib/sitemap";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("sitemap.xml needs `site` in astro.config");
  return new Response(buildSitemap(INDEXED_PAGES, site), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
