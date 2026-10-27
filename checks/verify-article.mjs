// Part 2 article: the built page meets the length and structure that the competitor analysis
// derives (docs/seo/serp.json), carries complete on-page SEO and structured data, and every
// catalogue figure it quotes equals a recomputation from the raw CSV files. Plain regex on the
// built HTML, no app code. Run after `bun run build`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { median, near, readDir } from "./lib/raw.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const PATH = "/blog/internet-croisiere-esim/";
const CANONICAL = `https://mybestsim.sbonneau.xyz${PATH}`;
const html = readFileSync(`dist${PATH}index.html`, "utf8");
const decode = (s) =>
  s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const text = (s) =>
  decode(s.replace(/<[^>]+>/g, " "))
    .replace(/[\s  ]+/g, " ")
    .trim();
const countWords = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

// Competitor analysis: enough pages, measured from their HTML.
const serp = JSON.parse(readFileSync("docs/seo/serp.json", "utf8"));
const competitors = serp.pages.filter((p) => !p.own && p.metrics);
if (competitors.length < 8) fail(`only ${competitors.length} competitor pages measured`);
const words = competitors.map((p) => p.metrics.words);
const target = median(words);

// The article body, scripts and styles removed.
const article = html.match(/<article id="article"[^>]*>([\s\S]*?)<\/article>/)?.[1];
if (!article) fail("no <article id=article>");
const body = article.replace(/<(script|style)[\s\S]*?<\/\1>/g, "");
const n = countWords(text(body));
if (n < target) fail(`${n} words, below the competitor median ${target}`);

const all = (re, s = html) => [...s.matchAll(re)];
const h1 = all(/<h1[^>]*>([\s\S]*?)<\/h1>/g);
if (h1.length !== 1) fail(`${h1.length} H1`);
const h1Text = text(h1[0][1]);
if (!/croisière/i.test(h1Text) || !/eSIM/.test(h1Text)) fail(`H1 "${h1Text}" misses the query`);
const h2 = all(/<h2[^>]*>([\s\S]*?)<\/h2>/g, body);
if (h2.length < 8) fail(`${h2.length} H2, the competitors' median is ${serp.summary.h2.median}`);
const tables = all(/<table[\s\S]*?<\/table>/g, body);
if (tables.length < 2 || tables.some((t) => !/<caption>/.test(t[0])))
  fail("comparison tables missing or without caption");
const faq = all(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g, body);
if (faq.length < 5) fail(`${faq.length} FAQ entries`);

// On-page SEO.
const meta = (name) =>
  html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];
const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
if (title.length < 30 || title.length > 60) fail(`title is ${title.length} characters`);
if (!/croisière/i.test(title) || !/eSIM/.test(title)) fail(`title "${title}" misses the query`);
const description = decode(meta("description") ?? "");
if (description.length < 120 || description.length > 160)
  fail(`meta description is ${description.length} characters`);
if (html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] !== CANONICAL) fail("canonical");
if (meta("og:type") !== "article" || meta("og:url") !== CANONICAL || !meta("og:title"))
  fail("Open Graph");
// The article is meant to be found: indexable, in the sitemap, which robots.txt announces. The
// dashboard pages stay out of search engines.
if (meta("robots") !== "index, follow") fail(`article robots "${meta("robots")}"`);
if (!readFileSync("dist/sitemap.xml", "utf8").includes(`<loc>${CANONICAL}</loc>`))
  fail("article missing from the sitemap");
if (
  !/^Sitemap: https:\/\/mybestsim\.sbonneau\.xyz\/sitemap\.xml$/m.test(
    readFileSync("dist/robots.txt", "utf8"),
  )
)
  fail("robots.txt does not announce the sitemap");
if (!/<meta name="robots" content="noindex/.test(readFileSync("dist/index.html", "utf8")))
  fail("the dashboard home lost its noindex");

// Structured data, consistent with the visible page.
const ld = JSON.parse(
  html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "null",
);
const graph = ld?.["@graph"] ?? [];
const node = (type) => graph.find((g) => g["@type"] === type) ?? fail(`no ${type} in JSON-LD`);
const art = node("Article");
if (art.headline !== h1Text) fail(`headline "${art.headline}" differs from the H1`);
if (art.mainEntityOfPage !== CANONICAL) fail("Article mainEntityOfPage");
const time = html.match(/<time datetime="([^"]+)"/)?.[1];
if (art.dateModified !== time) fail(`dateModified ${art.dateModified} vs visible ${time}`);
const questions = node("FAQPage").mainEntity;
if (questions.length !== faq.length) fail("FAQPage and visible FAQ differ in length");
questions.forEach((q, i) => {
  if (q.name !== text(faq[i][1]) || q.acceptedAnswer.text !== text(faq[i][2]))
    fail(`FAQ entry ${i + 1} differs from the page`);
});
const crumbs = node("BreadcrumbList").itemListElement;
if (crumbs.at(-1)?.item !== CANONICAL) fail("breadcrumb does not end on the article");

// Images: real ones have alt text, suggestions spell out theirs.
for (const img of all(/<img\b[^>]*>/g, body))
  if (!/\balt="[^"]+"/.test(img[0])) fail(`image without alt: ${img[0]}`);
const suggestions = all(/<figure class="suggestion">([\s\S]*?)<\/figure>/g, body);
if (suggestions.length < 3 || suggestions.some((s) => !/Texte alternatif/.test(s[1])))
  fail("image suggestions missing or without alt text");

// Catalogue prices: each itinerary row against the raw files.
const rows = readDir("data").filter((r) => r.valid);
const lines = all(
  /<tr data-itinerary="([^"]+)" data-codes="([^"]+)" data-min-gb="(\d+)" data-min-days="(\d+)">([\s\S]*?)<\/tr>/g,
  body,
);
if (lines.length < 6) fail(`${lines.length} itinerary rows`);
for (const [, id, codes, minGb, minDays, cells] of lines) {
  const fit = rows.filter(
    (r) => codes.split(",").includes(r.country_code) && r.days >= +minDays && r.gb >= +minGb,
  );
  const best = Math.min(...fit.map((r) => r.price));
  const price = Number(cells.match(/data-price="([^"]+)"/)?.[1]);
  if (!near(price, best)) fail(`${id}: page says ${price}, raw cheapest is ${best}`);
  const providers = new Set(fit.filter((r) => near(r.price, best)).map((r) => r.provider));
  // Columns: itinerary, ports, cheapest plan ("Provider, 5 Go, 7 jours"), price, link.
  const td = [...cells.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
  const shown = td[2]?.split(",")[0];
  if (!providers.has(shown)) fail(`${id}: provider ${shown} is not among ${[...providers]}`);
  const count = Number(text(cells.match(/(\d[\d\s  ]*) offres/)?.[1] ?? "").replace(/\s/g, ""));
  if (count !== fit.length) fail(`${id}: ${count} offers shown, ${fit.length} in the files`);
}
// "Unlimited costs less than 50 GB": both medians from the raw files.
const med = (pick) => median(rows.filter(pick).map((r) => r.price));
const unlimited = med((r) => r.gb === Number.POSITIVE_INFINITY);
const fifty = med((r) => r.gb === 50);
const eur = (x) => x.toFixed(2).replace(".", ",");
const plain = text(body);
if (
  !plain.includes(`forfait illimité (${eur(unlimited)} €)`) ||
  !plain.includes(`50 Go (${eur(fifty)} €)`)
)
  fail(`unlimited ${eur(unlimited)} / 50 GB ${eur(fifty)} medians not stated`);

// Links inside the site resolve, anchors exist, and no word is glued to a link.
const ids = new Set(all(/\bid="([^"]+)"/g).map((m) => m[1]));
for (const [, href] of all(/<a [^>]*href="([^"]+)"/g)) {
  if (href.startsWith("#")) {
    if (!ids.has(href.slice(1))) fail(`broken anchor ${href}`);
  } else if (href.startsWith("/")) {
    const path = href.split(/[?#]/)[0];
    const file = join("dist", path, path.endsWith("/") || !path.includes(".") ? "index.html" : "");
    if (!existsSync(file) && !existsSync(join("dist", path))) fail(`broken internal link ${href}`);
  }
}
if (/[\p{L},;:)]<a /u.test(body) || /<\/strong>\(/.test(body)) fail("a word is glued to a link");
const dashes = (plain.match(/—/g) ?? []).length;
if (dashes > 1) fail(`${dashes} em dashes`);

console.log(
  `${n} words (competitor median ${target}, ${competitors.length} pages), ${h2.length} H2, ${tables.length} tables, ${faq.length} FAQ, ${lines.length} itineraries priced from the raw files`,
);
console.log("ARTICLE ORACLE PASSED");
