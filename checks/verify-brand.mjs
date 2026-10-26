// The built CSS carries the MyBestSim tokens and a self-hosted Poppins; no page asks a
// third party for fonts or styles (the production CSP only allows 'self').
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const assets = readdirSync("dist/_astro");
const css = assets
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join("dist/_astro", f), "utf8"))
  .join("\n");
if (!css) fail("no CSS in dist/_astro");
const fonts = assets.filter((f) =>
  /^poppins-latin-(400|500|600|700)-(normal|italic).*\.woff2$/.test(f),
);
if (fonts.length < 5) fail(`expected 5 self-hosted Poppins woff2 files, found ${fonts.length}`);
if (!/font-family:\s*["']?Poppins/.test(css) || !/@font-face/.test(css))
  fail("Poppins @font-face missing");
for (const f of fonts) if (!css.includes(f)) fail(`${f} not referenced by the CSS`);

// Brand values measured on mybestsim.com on 2026-10-26: main #007bff, CTA #de1414,
// secondary #ffcc00, ink #0f172a, border #e2e8f0; light page by default.
const root = css.match(/:root\{[^}]*--page:[^}]*\}/i)?.[0] ?? fail("light :root tokens missing");
const tok = (block, name) =>
  block
    .match(new RegExp(`--${name}:\\s*([^;}]+)`))?.[1]
    ?.trim()
    .toLowerCase();
const expect = {
  s1: "#007bff",
  cta: "#de1414",
  warn: "#fc0",
  ink: "#0f172a",
  line: "#e2e8f0",
  surface: "#fff",
};
for (const [k, v] of Object.entries(expect)) {
  const got = tok(root, k);
  const long = (h) => (h?.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join("")}` : h);
  if (long(got) !== long(v)) fail(`--${k} is ${got}, expected ${v}`);
}
if (/@media\s*\(prefers-color-scheme:\s*dark\)/.test(css))
  fail("CSS still switches to dark from the OS setting");
if (!/\[data-theme=["']?dark["']?\]/.test(css)) fail("opt-in dark theme missing");

for (const page of ["dist/index.html", "dist/import/index.html"]) {
  const html = readFileSync(page, "utf8");
  const external = [
    ...html.matchAll(
      /<(?:link|script)[^>]+(?:href|src)="(https?:)?\/\/(?!mybestsim\.sbonneau\.xyz)[^"]+"/g,
    ),
  ].map((m) => m[0]);
  if (external.length) fail(`${page} loads third-party resources: ${external.join(" ")}`);
  if (!/<meta name="color-scheme" content="light"/.test(html))
    fail(`${page} color-scheme is not light`);
}
console.log(`${fonts.length} Poppins files, brand tokens ${Object.values(expect).join(" ")}`);
console.log("BRAND TOKENS OK");
