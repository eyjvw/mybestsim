// Every built page: one main landmark and one H1, a title and a meta description of a usable
// length, both unique across the site, indexable with a canonical equal to its own URL, and listed
// in the sitemap, which lists nothing else and which robots.txt announces. The 404 page is the
// one exception: noindex, no canonical, absent from the sitemap. Plain regex on the built HTML,
// no app code. Run after `bun run build`. Usage: bun checks/verify-seo.mjs [dist-dir]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const DIST = process.argv[2] ?? "dist";
const SITE = "https://mybestsim.sbonneau.xyz";
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;|&#160;/g, " ");

const htmlFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? htmlFiles(join(dir, e.name))
      : e.name.endsWith(".html")
        ? [join(dir, e.name)]
        : [],
  );
// dist/offres/index.html is served at /offres/, dist/index.html at /.
const urlPath = (file) =>
  `/${relative(DIST, file).split(sep).join("/")}`.replace(/index\.html$/, "");

const sitemapFile = join(DIST, "sitemap.xml");
if (!existsSync(sitemapFile)) fail("no sitemap.xml");
const sitemap = [...readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  decode(m[1]),
);
if (new Set(sitemap).size !== sitemap.length) fail("the sitemap lists a URL twice");
const robotsTxt = readFileSync(join(DIST, "robots.txt"), "utf8");
if (!robotsTxt.split("\n").includes(`Sitemap: ${SITE}/sitemap.xml`))
  fail("robots.txt does not announce the sitemap");
if (/^Disallow:\s*\/\s*$/m.test(robotsTxt)) fail("robots.txt blocks the whole site");

const titles = new Map();
const descriptions = new Map();
const indexed = [];
const files = htmlFiles(DIST);
if (files.length < 7) fail(`only ${files.length} HTML pages in ${DIST}`);
for (const file of files) {
  const path = urlPath(file);
  const html = readFileSync(file, "utf8");
  const meta = (name) =>
    html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];
  const where = `${path}:`;
  const mains = html.match(/<main[\s>]/g)?.length ?? 0;
  if (mains !== 1) fail(`${where} ${mains} main landmarks`);
  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) fail(`${where} ${h1s} H1`);
  if (!/<html lang="fr"/.test(html)) fail(`${where} no lang="fr"`);
  if (!/<meta name="viewport" content="width=device-width/.test(html)) fail(`${where} no viewport`);
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim();
  if (title.length < 15 || title.length > 60) fail(`${where} title is ${title.length} characters`);
  const description = decode(meta("description") ?? "");
  if (description.length < 70 || description.length > 160)
    fail(`${where} meta description is ${description.length} characters`);
  if (titles.has(title)) fail(`${where} same title as ${titles.get(title)}`);
  if (descriptions.has(description))
    fail(`${where} same description as ${descriptions.get(description)}`);
  titles.set(title, path);
  descriptions.set(description, path);
  const robots = meta("robots");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (path === "/404.html") {
    if (!robots?.includes("noindex")) fail(`${where} the 404 page is indexable`);
    if (canonical) fail(`${where} the 404 page has a canonical`);
    continue;
  }
  if (robots !== "index, follow") fail(`${where} robots "${robots}"`);
  if (canonical !== SITE + path) fail(`${where} canonical ${canonical}`);
  if (meta("og:url") !== SITE + path) fail(`${where} og:url ${meta("og:url")}`);
  if (!sitemap.includes(SITE + path)) fail(`${where} missing from the sitemap`);
  indexed.push(SITE + path);
}
for (const loc of sitemap)
  if (!indexed.includes(loc)) fail(`the sitemap lists ${loc}, not an indexable page`);
console.log(
  `${indexed.length} indexable pages, each in the sitemap with one main landmark; 404 kept out`,
);
console.log("SEO OK");
