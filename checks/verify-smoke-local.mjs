// Runs scripts/smoke.mjs against the real ingest server serving the build (static mode),
// i.e. the same routes the web container exposes. Run after `bun run build`.
import { spawnSync } from "node:child_process";
import { startServer } from "./lib/server.mjs";

const srv = await startServer({ STATIC_DIR: "dist" });
try {
  const r = spawnSync("node", ["scripts/smoke.mjs", srv.base, "oracle-token-0123456789abcdef"], {
    encoding: "utf8",
  });
  process.stdout.write(r.stdout + r.stderr);
  if (r.status !== 0) process.exit(1);
} finally {
  srv.stop();
}
