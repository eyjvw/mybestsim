import type { APIRoute } from "astro";
import { BUILD } from "../lib/build-info";
import { loadCatalog } from "../lib/load";

/** Full normalised catalog, fetched by the dashboard to filter client-side. */
export const GET: APIRoute = () =>
  Response.json({ generatedAt: BUILD.builtAt, products: loadCatalog().products });
