import { ARTICLE } from "./cruise";
import { SITE_NAV } from "./page-props";

export interface SitemapPage {
  path: string;
  lastmod: string;
}

/** A nav link in its canonical form: the trailing slash Astro gives every page's URL. */
export const canonicalPath = (href: string) => (href.endsWith("/") ? href : `${href}/`);

/**
 * Every page of the site navigation is indexed. The dashboard pages change with each build's
 * data snapshot; the article with its own update date.
 */
export function sitemapPages(builtAt: string): SitemapPage[] {
  return SITE_NAV.map(({ href }) => ({
    path: canonicalPath(href),
    lastmod: href === ARTICLE.path ? ARTICLE.updated : builtAt.slice(0, 10),
  }));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The sitemap.org urlset for `pages`, each path resolved against the site's origin. */
export function buildSitemap(pages: SitemapPage[], site: URL | string): string {
  const urls = pages
    .map(
      (p) =>
        `  <url><loc>${escapeXml(new URL(p.path, site).href)}</loc><lastmod>${p.lastmod}</lastmod></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
