import type { APIRoute } from "astro";
import { BUILD } from "../lib/build-info";

/** Lets CI confirm which commit is live after a deploy. */
export const GET: APIRoute = () => Response.json(BUILD);
