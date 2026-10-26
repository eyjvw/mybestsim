import type { APIRoute } from "astro";
import { loadCatalog } from "../lib/load";
import { buildSampleImport } from "../lib/sample";

/** Example "next day" Airalo file for the import preview: edits, additions and 2 bad rows. */
export const GET: APIRoute = () =>
  new Response(buildSampleImport(loadCatalog().products, "Airalo"), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
