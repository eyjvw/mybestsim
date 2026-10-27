export interface SitemapPage {
  path: string;
  lastmod: string;
}

/** Indexable pages only: the article. The dashboard pages carry a noindex meta. */
export const INDEXED_PAGES: SitemapPage[] = [
  { path: "/blog/internet-croisiere-esim/", lastmod: "2026-10-27" },
];

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
