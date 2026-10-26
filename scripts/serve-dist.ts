// Minimal static server for dist/, used by the e2e suite (astro preview runs detached).
// Usage: bun scripts/serve-dist.ts [port]. E2E_DIST serves another build (negative controls).
import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const root = process.env.E2E_DIST ?? join(process.cwd(), "dist");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4322);

function resolve(pathname: string): string | null {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const target = join(root, clean);
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  return existsSync(index) ? index : null;
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(req) {
    const file = resolve(new URL(req.url).pathname);
    return file ? new Response(Bun.file(file)) : new Response("Not found", { status: 404 });
  },
});
console.log(`serving dist/ on http://127.0.0.1:${server.port}`);
