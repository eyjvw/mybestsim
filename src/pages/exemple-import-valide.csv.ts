import type { APIRoute } from "astro";
import { loadCatalog } from "../lib/load";
import { buildSampleImport } from "../lib/sample";

/** The same example Airalo file without its invalid rows: it passes validation and the guard. */
export const GET: APIRoute = () =>
  new Response(buildSampleImport(loadCatalog().products, "Airalo", { invalidRows: false }), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
