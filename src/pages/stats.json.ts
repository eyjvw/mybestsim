import type { APIRoute } from "astro";
import { BUILD } from "../lib/build-info";
import { loadCatalog } from "../lib/load";
import { statsPayload } from "../lib/payload";

/** Machine-readable report: the same figures as the dashboard, for other tools to consume. */
export const GET: APIRoute = () => {
  const { products, quality } = loadCatalog();
  return Response.json(statsPayload(products, quality, BUILD.builtAt));
};
