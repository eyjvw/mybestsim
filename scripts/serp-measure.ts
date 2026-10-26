// Measures the pages that rank for the article's target queries, from their HTML: words of the
// main content, headings, tables, FAQ, images, structured data and dates. The article's length
// and structure come from these numbers (docs/seo/ANALYSE.md), not from a guess.
// Usage: bun scripts/serp-measure.ts [docs/seo/serp-urls.json] [docs/seo/serp.json]

const SKIP = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "button",
  "select",
]);

export interface PageMetrics {
  title: string;
  description: string;
  lang: string;
  h1: string[];
  h2: string[];
  h3: string[];
  words: number;
  /** Where the words were counted: the largest <article>, else <main>, else <body>. */
  root: "article" | "main" | "body";
  tables: number;
  images: number;
  faq: boolean;
  schemaTypes: string[];
  published: string | null;
  modified: string | null;
}

const countWords = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function schemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) schemaTypes(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const t = o["@type"];
  for (const v of Array.isArray(t) ? t : [t]) if (typeof v === "string") out.add(v);
  for (const v of Object.values(o)) if (v && typeof v === "object") schemaTypes(v, out);
}

/** Metrics of one HTML document. Pure: no network. */
export async function measureHtml(html: string): Promise<PageMetrics> {
  const stack: string[] = [];
  let skip = 0;
  let articleIndex = -1;
  let articles = 0;
  let inMain = 0;
  const words = { body: 0, main: 0, article: new Map<number, number>() };
  const content = {
    tables: { body: 0, main: 0, article: 0 },
    images: { body: 0, main: 0, article: 0 },
  };
  const headings: Record<"h1" | "h2" | "h3", string[]> = { h1: [], h2: [], h3: [] };
  let heading: { level: "h1" | "h2" | "h3"; text: string } | null = null;
  const meta: Record<string, string> = {};
  let title = "";
  let inTitle = false;
  let lang = "";
  const ldBlocks: string[] = [];
  let ld: string | null = null;

  const where = () => ({ article: articleIndex >= 0, main: inMain > 0 });
  const rewriter = new HTMLRewriter()
    .on("html", {
      element(el) {
        lang = el.getAttribute("lang") ?? "";
      },
    })
    .on("meta", {
      element(el) {
        const key = el.getAttribute("name") ?? el.getAttribute("property");
        const value = el.getAttribute("content");
        if (key && value) meta[key.toLowerCase()] = value;
      },
    })
    // One handler for every element: lol-html keeps a single end-tag callback per element, so a
    // second selector registering its own would silently replace this one.
    .on("*", {
      element(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === "title") {
          inTitle = true;
          el.onEndTag(() => {
            inTitle = false;
          });
          return;
        }
        if (tag === "script" && el.getAttribute("type") === "application/ld+json") {
          ld = "";
          el.onEndTag(() => {
            if (ld !== null) ldBlocks.push(ld);
            ld = null;
          });
          return;
        }
        const w = where();
        if (tag === "table" && !skip) {
          content.tables.body += 1;
          if (w.main) content.tables.main += 1;
          if (w.article) content.tables.article += 1;
        }
        if (tag === "img" && !skip) {
          content.images.body += 1;
          if (w.main) content.images.main += 1;
          if (w.article) content.images.article += 1;
        }
        if (!el.canHaveContent || el.selfClosing) return;
        stack.push(tag);
        if (SKIP.has(tag)) skip += 1;
        if (tag === "main") inMain += 1;
        let previousArticle = articleIndex;
        if (tag === "article" && articleIndex < 0) {
          previousArticle = -1;
          articleIndex = articles++;
        }
        if ((tag === "h1" || tag === "h2" || tag === "h3") && !skip)
          heading = { level: tag, text: "" };
        el.onEndTag(() => {
          stack.pop();
          if (SKIP.has(tag)) skip -= 1;
          if (tag === "main") inMain -= 1;
          if (tag === "article") articleIndex = previousArticle;
          if (heading && heading.level === tag) {
            const text = clean(heading.text);
            if (text) headings[heading.level].push(text);
            heading = null;
          }
        });
      },
    })
    .onDocument({
      text(t) {
        if (inTitle) {
          title += t.text;
          return;
        }
        if (ld !== null) {
          ld += t.text;
          return;
        }
        if (skip) return;
        if (heading) heading.text += t.text;
        const n = countWords(t.text);
        if (!n) return;
        words.body += n;
        if (inMain) words.main += n;
        if (articleIndex >= 0)
          words.article.set(articleIndex, (words.article.get(articleIndex) ?? 0) + n);
      },
    });
  await rewriter.transform(new Response(html)).text();

  const types = new Set<string>();
  for (const block of ldBlocks) {
    try {
      schemaTypes(JSON.parse(block), types);
    } catch {}
  }
  const biggestArticle = Math.max(0, ...words.article.values());
  // A page wraps its text in <article> or <main> only when they hold most of it.
  const root =
    biggestArticle >= 300 && biggestArticle >= words.body * 0.4
      ? "article"
      : words.main >= 300 && words.main >= words.body * 0.4
        ? "main"
        : "body";
  const faqHeading = [...headings.h2, ...headings.h3].some((h) =>
    /\bfaq\b|questions? fréquentes|questions courantes|frequently asked/i.test(h),
  );
  const dates = ldBlocks.join(" ");
  return {
    title: clean(title),
    description: clean(meta.description ?? meta["og:description"] ?? ""),
    lang,
    ...headings,
    words: root === "article" ? biggestArticle : root === "main" ? words.main : words.body,
    root,
    tables: content.tables[root],
    images: content.images[root],
    faq: types.has("FAQPage") || faqHeading,
    schemaTypes: [...types].sort(),
    published:
      meta["article:published_time"] ?? dates.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ?? null,
    modified:
      meta["article:modified_time"] ?? dates.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1] ?? null,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function summarize(pages: { own?: boolean; metrics?: PageMetrics }[]) {
  const measured = pages.filter((p) => !p.own && p.metrics).map((p) => p.metrics as PageMetrics);
  const share = (f: (m: PageMetrics) => boolean) =>
    Math.round((measured.filter(f).length / measured.length) * 100);
  return {
    competitors: measured.length,
    words: {
      median: median(measured.map((m) => m.words)),
      max: Math.max(...measured.map((m) => m.words)),
      min: Math.min(...measured.map((m) => m.words)),
    },
    h2: { median: median(measured.map((m) => m.h2.length)) },
    withTable: share((m) => m.tables > 0),
    withFaq: share((m) => m.faq),
    withImages: share((m) => m.images > 0),
    withArticleSchema: share((m) =>
      m.schemaTypes.some((t) => /^(Article|BlogPosting|NewsArticle)$/.test(t)),
    ),
  };
}

if (import.meta.main) {
  const [input = "docs/seo/serp-urls.json", output = "docs/seo/serp.json"] = Bun.argv.slice(2);
  const list = (await Bun.file(input).json()) as {
    pages: { url: string; own?: boolean }[];
  };
  const UA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const pages = [];
  for (const p of list.pages) {
    try {
      const r = await fetch(p.url, {
        headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
        signal: AbortSignal.timeout(30_000),
      });
      const html = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const metrics = await measureHtml(html);
      pages.push({ ...p, status: r.status, metrics });
      console.log(`${metrics.words} words, ${metrics.h2.length} H2 (${metrics.root}) ${p.url}`);
    } catch (e) {
      pages.push({ ...p, error: String(e) });
      console.log(`ERROR ${p.url}: ${e}`);
    }
  }
  const result = { measuredAt: new Date().toISOString(), summary: summarize(pages), pages };
  await Bun.write(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result.summary));
}
