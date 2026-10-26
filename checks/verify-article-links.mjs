// Every external link of the article answers: sources and mybestsim.com pages exist, so no
// claim points to an invented URL. Needs the network, so it runs locally (bun run checks --local)
// after `bun run build`, not in CI.
import { readFileSync } from "node:fs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const html = readFileSync("dist/blog/internet-croisiere-esim/index.html", "utf8");
const article = html.match(/<article id="article"[^>]*>([\s\S]*?)<\/article>/)?.[1] ?? "";
const links = [
  ...new Set(
    [...article.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"/g)].map((m) =>
      m[1].replace(/&amp;/g, "&"),
    ),
  ),
];
if (links.length < 15) fail(`only ${links.length} external links`);
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const broken = [];
await Promise.all(
  links.map(async (url) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
          redirect: "follow",
          signal: AbortSignal.timeout(30_000),
        });
        if (r.status < 400) return;
        if (attempt) broken.push(`${r.status} ${url}`);
      } catch (e) {
        if (attempt) broken.push(`${e.name} ${url}`);
      }
    }
  }),
);
if (broken.length) fail(`broken links:\n${broken.join("\n")}`);
const mbs = links.filter((l) => l.startsWith("https://mybestsim.com/")).length;
console.log(`${links.length} external links answer, ${mbs} of them on mybestsim.com`);
console.log("ARTICLE LINKS OK");
