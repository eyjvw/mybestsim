import type { APIRoute } from "astro";

/**
 * Placeholder for static hosting: in production Caddy serves /data from the ingest volume,
 * so this file is never seen there. Anywhere else it tells the page "no live data" with a
 * 200, instead of three 404s in the console.
 */
export const GET: APIRoute = () => Response.json({ live: false });
