// Ingest service: validates and publishes supplier CSVs into the data volume, no rebuild.
// Env: PORT, DATA_DIR, SEED_DIR, INGEST_TOKEN, WEBHOOK_URL, SITE_URL, MAX_UPLOAD_MB,
//      INBOX_INTERVAL_MS, STATIC_DIR. Flag --ephemeral: temporary DATA_DIR, removed on exit.
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createApp } from "./app";
import { startInbox } from "./inbox";
import { MIN_TOKEN_LENGTH, resolveToken } from "./security";
import { DataStore } from "./store";
import { sendWebhook } from "./webhook";

const { values } = parseArgs({ options: { ephemeral: { type: "boolean", default: false } } });
const env = process.env;
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
// Ephemeral volumes are named after their server's pid: a server killed with SIGKILL (as test
// runners do) cannot clean up, so the next one removes volumes whose process is gone.
const ephemeralVolume = () => {
  for (const d of readdirSync(tmpdir())) {
    const pid = Number(d.match(/^mbs-data-(\d+)-/)?.[1]);
    if (pid && !alive(pid)) rmSync(join(tmpdir(), d), { recursive: true, force: true });
  }
  return mkdtempSync(join(tmpdir(), `mbs-data-${process.pid}-`));
};
const dataDir = values.ephemeral ? ephemeralVolume() : (env.DATA_DIR ?? "/data");

const store = new DataStore(dataDir, { seedDir: env.SEED_DIR ?? "data" });
store.init();
const notify = (o: Parameters<typeof sendWebhook>[1]) =>
  sendWebhook(env.WEBHOOK_URL, o, env.SITE_URL);
const token = resolveToken(env.INGEST_TOKEN);
if (env.INGEST_TOKEN && !token) {
  console.warn(`INGEST_TOKEN ignored: ${MIN_TOKEN_LENGTH} characters minimum`);
}
const app = createApp(store, {
  token,
  maxBytes: Number(env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
  staticDir: env.STATIC_DIR,
  notify,
});
const stopInbox = startInbox(store, Number(env.INBOX_INTERVAL_MS ?? 10_000), notify);
const server = Bun.serve({
  port: Number(env.PORT ?? 3000),
  hostname: env.HOST ?? "0.0.0.0",
  maxRequestBodySize: Number(env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024 + 64 * 1024,
  fetch: (req, srv) => app(req, srv.requestIP(req)?.address ?? "unknown"),
});
console.log(
  `ingest on http://${server.hostname}:${server.port} · data ${dataDir} · release ${store.currentId()} · publish ${token ? "on" : "off"}`,
);

const stop = () => {
  stopInbox();
  server.stop();
  if (values.ephemeral) rmSync(dataDir, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
