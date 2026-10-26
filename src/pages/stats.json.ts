import type { APIRoute } from "astro";
import { BUILD } from "../lib/build-info";
import { loadCatalog } from "../lib/load";
import { computeStats } from "../lib/stats";

/** Machine-readable report: the same figures as the dashboard, for other tools to consume. */
export const GET: APIRoute = () => {
  const { products, quality } = loadCatalog();
  return Response.json({ generatedAt: BUILD.builtAt, ...computeStats(products), quality });
};
