import type { APIRoute } from "astro";

/**
 * Placeholder for static hosting, like /data/version.json: in production Caddy serves
 * /sandbox/data from the ingest volume. Anywhere else it says "no sandbox" with a 200.
 */
export const GET: APIRoute = () => Response.json({ live: false });
