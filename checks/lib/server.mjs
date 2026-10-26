// Starts the real ingest server on a temporary volume for an oracle, and stops it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function startServer(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mbs-oracle-"));
  const port = 4400 + Math.floor(Math.random() * 500);
  const child = spawn("bun", ["server/main.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_DIR: join(dir, "volume"),
      SEED_DIR: "data",
      INGEST_TOKEN: "oracle-token-0123456789abcdef",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    child.kill("SIGTERM");
    rmSync(dir, { recursive: true, force: true });
  };
  // fail() calls process.exit, which skips `finally`: clean up on exit as well.
  process.on("exit", stop);
  return { base, dir, volume: join(dir, "volume"), stop, log: () => log };
}
