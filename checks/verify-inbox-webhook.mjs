// A CSV dropped in the inbox of the running service is imported, and the configured
// webhook receives the outcome.
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { startServer } from "./lib/server.mjs";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const received = [];
const hook = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    received.push(JSON.parse(body));
    res.writeHead(204).end();
  });
});
await new Promise((r) => hook.listen(0, "127.0.0.1", r));
const hookUrl = `http://127.0.0.1:${hook.address().port}/hook`;
const srv = await startServer({ WEBHOOK_URL: hookUrl, INBOX_INTERVAL_MS: "300" });

try {
  const before = (await (await fetch(`${srv.base}/api/health`)).json()).importId;
  const header =
    "sku,provider,product_name,country_code,country_name,data_gb,data_display,validity_days,price,currency,network,top_up";
  const file = join(srv.volume, "inbox", "nouveau.csv");
  writeFileSync(
    file,
    `${header}\nnouveau-1,Nouveau Mobile,eSIM Japon 5 Go 15 jours,JP,Japon,5,5 Go,15,9.99,EUR,5G,oui\n`,
  );
  let after = before;
  for (let i = 0; i < 80 && (after === before || received.length === 0); i++) {
    await new Promise((r) => setTimeout(r, 250));
    after = (await (await fetch(`${srv.base}/api/health`)).json()).importId;
  }
  if (after === before) fail(`inbox file not imported\n${srv.log()}`);
  const v = await (await fetch(`${srv.base}/data/version.json`)).json();
  // A new provider keeps the dropped file name when it is free.
  if (v.source !== "inbox" || !v.files.includes("nouveau.csv"))
    fail(`version ${JSON.stringify(v)}`);
  const cat = await (await fetch(`${srv.base}/data/catalog.json`)).json();
  if (!cat.products.some((p) => p.sku === "nouveau-1"))
    fail("new offer missing from the live catalog");
  if (
    received.length !== 1 ||
    received[0].event !== "import.published" ||
    received[0].importId !== after
  )
    fail(`webhook payload ${JSON.stringify(received)}`);
  console.log(
    `inbox import ${after} (source inbox, new provider file nouveau.csv); webhook got ${received[0].event}`,
  );
  console.log("INBOX WEBHOOK OK");
} finally {
  srv.stop();
  hook.close();
}
