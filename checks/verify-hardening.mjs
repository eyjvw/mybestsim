// Hardening taken from an earlier SSR + SQLite prototype, through the real server: short tokens,
// rate limits, unchanged re-sends and the CLI next to a running server.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./lib/server.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const TOKEN = "oracle-token-0123456789abcdef";
const offer = (sku, price) =>
  `${sku},Roamic,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,${price},EUR,5G,oui`;
const roamic = readFileSync("data/roamic.csv", "utf8").trimEnd();
const post = (base, text, { token, ip = "198.51.100.1", query = "" } = {}) =>
  fetch(`${base}/api/imports?file=roamic.csv${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: text,
  });

// 1. A token under 24 characters disables publishing instead of protecting it weakly.
const weak = await startServer({ INGEST_TOKEN: "short-token" });
try {
  if ((await post(weak.base, `${roamic}\n`, { token: "short-token" })).status !== 503)
    fail("short token accepted");
  if (!/INGEST_TOKEN ignored: 24 characters minimum/.test(weak.log()))
    fail("no warning for a short token");
} finally {
  weak.stop();
}

const srv = await startServer();
const dir = mkdtempSync(join(tmpdir(), "mbs-hardening-"));
try {
  const file = `${roamic}\n${offer("roamic-990001", 9.99)}\n`;
  // 2. Ten failed tokens from one client, then even the right token gets 429; another client is fine.
  for (let i = 0; i < 10; i++) {
    const s = (await post(srv.base, file, { token: `wrong-${i}` })).status;
    if (s !== 401) fail(`failed token ${i} returned ${s}`);
  }
  if ((await post(srv.base, file, { token: TOKEN })).status !== 429)
    fail("no 429 after 10 failures");
  const ok = await post(srv.base, file, { token: TOKEN, ip: "198.51.100.2" });
  if (ok.status !== 201) fail(`publish from another client returned ${ok.status}`);
  const id = (await ok.json()).importId;

  // 3. The same file again: unchanged, same release.
  const again = await post(srv.base, file, { token: TOKEN, ip: "198.51.100.2" });
  const body = await again.json();
  if (again.status !== 200 || body.status !== "unchanged")
    fail(`re-send: ${again.status} ${body.status}`);
  if ((await (await fetch(`${srv.base}/api/health`)).json()).importId !== id)
    fail("unchanged re-send made a release");

  // 4. Thirty anonymous previews a minute per client, then 429.
  for (let i = 0; i < 30; i++) {
    const s = (await post(srv.base, file, { ip: "198.51.100.3", query: "&dryRun=1" })).status;
    if (s !== 200) fail(`preview ${i} returned ${s}`);
  }
  if ((await post(srv.base, file, { ip: "198.51.100.3", query: "&dryRun=1" })).status !== 429)
    fail("no preview limit");

  // 5. The CLI writes into the running server's volume; the server serves it at once.
  const csv = join(dir, "roamic.csv");
  writeFileSync(csv, `${file}${offer("roamic-990002", 10.99)}\n`);
  const cli = spawnSync("bun", ["scripts/import.ts", "--data-dir", srv.volume, csv], {
    encoding: "utf8",
  });
  if (cli.status !== 0 || !cli.stdout.includes("publié")) fail(`CLI: ${cli.stdout}${cli.stderr}`);
  const cat = await (await fetch(`${srv.base}/data/catalog.json`)).json();
  if (!cat.products.some((p) => p.sku === "roamic-990002"))
    fail("CLI release not served by the running server");
  const history = (await (await fetch(`${srv.base}/api/imports`)).json()).imports.map(
    (h) => h.status,
  );
  if (
    JSON.stringify(history.slice(0, 3)) !== JSON.stringify(["published", "unchanged", "published"])
  )
    fail(`history ${history}`);

  console.log(
    "short token refused; 10 failures then 429; unchanged re-send; 30 previews then 429; CLI release served live",
  );
  console.log("HARDENING ORACLE PASSED");
} finally {
  srv.stop();
  rmSync(dir, { recursive: true, force: true });
}
