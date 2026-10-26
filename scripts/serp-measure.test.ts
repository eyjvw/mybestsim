import { describe, expect, test } from "bun:test";
import { measureHtml, summarize } from "./serp-measure";

const words = (n: number, w = "mot") => Array.from({ length: n }, () => w).join(" ");

const page = (body: string, head = "") => `<!doctype html><html lang="fr"><head>
<title>Internet en croisière</title><meta name="description" content="Guide  complet">${head}
</head><body>${body}</body></html>`;

describe("measureHtml", () => {
  test("counts the words of the largest article only, without navigation, scripts or footer", async () => {
    const m = await measureHtml(
      page(`<header><nav>${words(50, "menu")}</nav></header>
      <article><h1>Titre</h1><p>${words(400)}</p><script>var x = "${words(30)}";</script>
      <h2>Wi-Fi à bord</h2><p>${words(100)}</p><table><tr><td>a</td></tr></table>
      <img src="a.png" alt="a"><h3>Le prix</h3></article>
      <aside>${words(80)}</aside><footer>${words(60)}</footer>`),
    );
    // 400 + 100 words, the heading words ("Titre", "Wi-Fi à bord", "Le prix") and the cell "a".
    expect(m.root).toBe("article");
    expect(m.words).toBe(400 + 100 + 1 + 3 + 2 + 1);
    expect(m.h1).toEqual(["Titre"]);
    expect(m.h2).toEqual(["Wi-Fi à bord"]);
    expect(m.h3).toEqual(["Le prix"]);
    expect(m.tables).toBe(1);
    expect(m.images).toBe(1);
    expect(m.title).toBe("Internet en croisière");
    expect(m.description).toBe("Guide complet");
    expect(m.lang).toBe("fr");
  });

  test("falls back to <main>, then to <body>, when no article holds the text", async () => {
    const main = await measureHtml(page(`<main><p>${words(500)}</p></main><p>${words(20)}</p>`));
    expect(main.root).toBe("main");
    expect(main.words).toBe(500);
    const body = await measureHtml(page(`<div><p>${words(350)}</p></div>`));
    expect(body.root).toBe("body");
    expect(body.words).toBe(350);
  });

  test("a tiny <article> card does not hide the real content", async () => {
    const m = await measureHtml(
      page(`<article><p>${words(20)}</p></article><main><p>${words(600)}</p></main>`),
    );
    expect(m.root).toBe("main");
    expect(m.words).toBe(600);
  });

  test("detects FAQ from FAQPage schema or from a heading, and reads schema types and dates", async () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "BlogPosting", datePublished: "2026-01-02", dateModified: "2026-03-04" },
        { "@type": "FAQPage", mainEntity: [{ "@type": "Question" }] },
      ],
    });
    const m = await measureHtml(
      page(`<p>${words(10)}</p>`, `<script type="application/ld+json">${ld}</script>`),
    );
    expect(m.faq).toBe(true);
    expect(m.schemaTypes).toEqual(["BlogPosting", "FAQPage", "Question"]);
    expect(m.published).toBe("2026-01-02");
    expect(m.modified).toBe("2026-03-04");
    const byHeading = await measureHtml(page(`<h2>Questions fréquentes</h2><p>x</p>`));
    expect(byHeading.faq).toBe(true);
    const none = await measureHtml(page(`<h2>Conclusion</h2><p>x</p>`));
    expect(none.faq).toBe(false);
  });
});

describe("summarize", () => {
  test("medians and shares over competitors only, never over MyBestSim's own pages", () => {
    const m = (words: number, h2: number, tables: number, faq: boolean) => ({
      metrics: {
        words,
        h2: Array(h2).fill("x"),
        tables,
        faq,
        images: 1,
        schemaTypes: faq ? ["Article"] : [],
      } as never,
    });
    const s = summarize([
      m(1000, 4, 0, false),
      m(3000, 8, 1, true),
      m(2000, 6, 1, true),
      {
        own: true,
        metrics: {
          words: 99_999,
          h2: [],
          tables: 0,
          faq: false,
          images: 0,
          schemaTypes: [],
        } as never,
      },
    ]);
    expect(s.competitors).toBe(3);
    expect(s.words).toEqual({ median: 2000, max: 3000, min: 1000 });
    expect(s.h2.median).toBe(6);
    expect(s.withTable).toBe(67);
    expect(s.withFaq).toBe(67);
    expect(s.withArticleSchema).toBe(67);
  });
});
