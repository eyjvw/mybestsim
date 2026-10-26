// Validates the image Caddyfile with a real Caddy 2 binary (PATH or ~/.local/bin),
// and checks the validator rejects a broken copy (positive control).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};
const bin = [process.env.CADDY_BIN, "caddy", join(homedir(), ".local/bin/caddy")].find(
  (b) => b && spawnSync(b, ["version"], { encoding: "utf8" }).status === 0,
);
if (!bin) fail("caddy binary not found (PATH, ~/.local/bin or CADDY_BIN)");
const version = spawnSync(bin, ["version"], { encoding: "utf8" }).stdout.trim();
if (!/^v2\./.test(version)) fail(`unexpected caddy ${version}`);
const validate = (file) =>
  spawnSync(bin, ["validate", "--adapter", "caddyfile", "--config", file], {
    encoding: "utf8",
    env: { ...process.env, INGEST_UPSTREAM: "" },
  });

const dir = mkdtempSync(join(tmpdir(), "mbs-caddy-"));
try {
  const broken = join(dir, "Caddyfile");
  writeFileSync(
    broken,
    readFileSync("docker/Caddyfile", "utf8").replace(
      "handle_path /data/* {",
      "handle_path /data/* {{",
    ),
  );
  if (validate(broken).status === 0) fail("validator accepted a broken Caddyfile");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const r = validate("docker/Caddyfile");
const out = `${r.stdout}${r.stderr}`;
if (r.status !== 0) fail(out);
console.log(`caddy ${version.split(" ")[0]}: ${out.match(/Valid configuration/)?.[0] ?? "?"}`);
