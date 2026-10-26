import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DataStore, type ImportOutcome, newImportId } from "./store";

/** Files younger than this may still be uploading (SFTP, rsync): picked up next round. */
const SETTLE_MS = 2000;

/**
 * One inbox round: every settled CSV is imported as a single batch, then moved to
 * inbox/done/<id>/ or inbox/rejected/<stamp>/ with the report next to it.
 */
export async function processInbox(
  store: DataStore,
  now = Date.now(),
): Promise<ImportOutcome | null> {
  const names = readdirSync(store.inboxDir).filter((f) => {
    if (!f.toLowerCase().endsWith(".csv")) return false;
    return now - statSync(join(store.inboxDir, f)).mtimeMs >= SETTLE_MS;
  });
  if (names.length === 0) return null;
  const files = names
    .sort()
    .map((file) => ({ file, text: readFileSync(join(store.inboxDir, file), "utf8") }));
  const outcome = await store.import(files, { source: "inbox" });
  const dest =
    outcome.status === "published"
      ? join(store.inboxDir, "done", outcome.importId as string)
      : join(store.inboxDir, "rejected", newImportId());
  mkdirSync(dest, { recursive: true });
  for (const f of names) renameSync(join(store.inboxDir, f), join(dest, f));
  writeFileSync(join(dest, "report.md"), outcome.report);
  return outcome;
}

export function startInbox(
  store: DataStore,
  intervalMs: number,
  notify?: (o: ImportOutcome) => Promise<unknown>,
): () => void {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const outcome = await processInbox(store);
      if (outcome) {
        console.log(
          `inbox: ${outcome.status} ${outcome.importId ?? ""} ${outcome.reasons.join(" ")}`,
        );
        await notify?.(outcome);
      }
    } catch (e) {
      console.error(`inbox: ${String(e)}`);
    } finally {
      busy = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
