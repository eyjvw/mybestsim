import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import type { SupplierFile } from "../src/lib/release";
import { clientKey, rateLimiter, sameToken } from "./security";
import type { DataStore, ImportOutcome } from "./store";

export interface AppConfig {
  /** Bearer token required to publish; null disables publishing (preview still works). */
  token: string | null;
  maxBytes: number;
  /** Serve the built site too (local dev and e2e); Caddy does it in production. */
  staticDir?: string;
  notify?: (outcome: ImportOutcome) => Promise<unknown>;
  /** Failed tokens and anonymous previews allowed per client and minute. */
  limits?: { authFailures: number; previews: number };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const error = (status: number, message: string) => json({ error: message }, status);

/** Resolves a URL path inside `root`, or null when it escapes it or does not exist. */
function inside(root: string, pathname: string): string | null {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const target = join(root, clean);
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  return existsSync(index) ? index : null;
}

async function readUploads(req: Request, url: URL): Promise<SupplierFile[]> {
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const files: SupplierFile[] = [];
    for (const v of form.getAll("file")) {
      if (typeof v !== "string") files.push({ file: v.name, text: await v.text() });
    }
    return files;
  }
  if (type.startsWith("text/csv") || type.startsWith("text/plain")) {
    return [{ file: url.searchParams.get("file") ?? "import.csv", text: await req.text() }];
  }
  throw new TypeError(
    "Envoyez un ou plusieurs fichiers CSV (multipart, champ « file ») ou un corps text/csv.",
  );
}

const STATUS: Record<ImportOutcome["status"], number> = {
  published: 201,
  unchanged: 200,
  preview: 200,
  rejected: 422,
  held: 409,
};

export function createApp(store: DataStore, config: AppConfig) {
  const authFailures = rateLimiter(config.limits?.authFailures ?? 10, 60_000);
  const previews = rateLimiter(config.limits?.previews ?? 30, 60_000);

  return async function fetch(req: Request, socketAddress = "local"): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const client = clientKey(req, socketAddress);

    if (path === "/api/health") return json({ ok: true, importId: store.currentId() });
    if (path === "/api/imports" && req.method === "GET")
      return json({ imports: store.history(20) });

    if (path === "/api/imports" && req.method === "POST") {
      const dryRun = url.searchParams.get("dryRun") === "1";
      if (dryRun) {
        if (previews.blocked(client))
          return error(429, "Trop d'aperçus, réessayez dans une minute.");
        previews.hit(client);
      } else {
        if (!config.token) {
          return error(
            503,
            "La publication est désactivée sur ce serveur (INGEST_TOKEN absent ou trop court).",
          );
        }
        // Checked before the comparison: a blocked client cannot keep guessing.
        if (authFailures.blocked(client)) {
          return error(429, "Trop de tentatives, réessayez dans une minute.");
        }
        const given =
          req.headers
            .get("authorization")
            ?.match(/^Bearer\s+(.+)$/i)?.[1]
            .trim() ?? "";
        if (!given || !sameToken(given, config.token)) {
          authFailures.hit(client);
          return error(401, "Jeton de publication manquant ou invalide.");
        }
      }
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > config.maxBytes)
        return error(413, `Fichier trop gros (maximum ${config.maxBytes / 1024 / 1024} Mo).`);
      let uploads: SupplierFile[];
      try {
        uploads = await readUploads(req, url);
      } catch (e) {
        return error(415, e instanceof TypeError ? e.message : "Corps de requête illisible.");
      }
      if (uploads.reduce((n, f) => n + f.text.length, 0) > config.maxBytes) {
        return error(413, `Fichier trop gros (maximum ${config.maxBytes / 1024 / 1024} Mo).`);
      }
      if (uploads.some((f) => !f.file.toLowerCase().endsWith(".csv"))) {
        return error(415, "Seuls les fichiers .csv sont acceptés.");
      }
      const outcome = await store.import(uploads, {
        source: "api",
        dryRun,
        force: url.searchParams.get("force") === "1",
      });
      if (!dryRun) void config.notify?.(outcome);
      return json(outcome, STATUS[outcome.status]);
    }

    if (path.startsWith("/api/")) return error(404, "Route inconnue.");

    // Static mode (dev, e2e): /data/* from the current release, the rest from the build.
    if (req.method === "GET" || req.method === "HEAD") {
      if (path.startsWith("/data/")) {
        const file = inside(store.currentLink, path.slice("/data".length));
        return file
          ? new Response(Bun.file(file), { headers: { "Cache-Control": "no-cache" } })
          : error(404, "Introuvable.");
      }
      if (config.staticDir) {
        const file = inside(config.staticDir, path);
        if (file) return new Response(Bun.file(file));
      }
    }
    return error(404, "Introuvable.");
  };
}
