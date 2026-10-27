import type { LiveReply } from "./live";
import { type LiveCatalog, loadCatalog } from "./runtime";

/** The part of a Worker this module uses, so tests can stand in for it. */
export interface WorkerLike {
  onmessage: ((e: MessageEvent<LiveReply>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

const spawn = (): WorkerLike =>
  new Worker(new URL("../workers/live.worker.ts", import.meta.url), { type: "module" });

/**
 * The live catalog, fetched and summarised in a Web Worker; the page only parses the products.
 * Without workers (or if the worker fails) the page loads it itself, as before.
 */
export async function loadLive(
  base: string,
  create: () => WorkerLike = spawn,
): Promise<LiveCatalog> {
  try {
    const reply = await new Promise<LiveReply>((resolve, reject) => {
      const worker = create();
      worker.onmessage = (e) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(e);
      };
      worker.postMessage({ base });
    });
    if (reply.ok) {
      return { ...reply.catalog, products: JSON.parse(reply.products), summary: reply.summary };
    }
  } catch {
    // Fall through to the main thread.
  }
  return loadCatalog(undefined, base);
}
