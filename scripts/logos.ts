// Regenerates public/logos/<slug>.webp, one 64x64 WebP per provider, from the sources below.
// Usage: bun run logos
// The logos belong to their brands; they only identify each provider, as on mybestsim.com.
// Sources checked on 2026-10-28. mybestsim.com first, so the dashboard shows the logos the
// comparator itself shows; the provider's official site when mybestsim.com has none, or when its
// file is a wordmark unreadable at 20 px. Truphone has none: truphone.com redirects to 1GLOBAL.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LOGOS } from "../src/lib/logos";

const MBS = "https://mybestsim.com/wp-content/uploads";
export const SOURCES: Record<string, string> = {
  "4sesim": `${MBS}/2026/02/4sesim-logo.jpg`,
  airalo: "https://www.airalo.com/apple-touch-icon-180x180.png",
  alosim: "https://alosim.com/wp-content/uploads/2024/05/665886e143b63-fav-icon-3.webp",
  esimx: `${MBS}/2025/04/esimx-esim-logo.png`,
  flexiroam: "https://www.flexiroam.com/apple-touch-icon.png",
  gigsky:
    "https://cdn.sanity.io/images/4lreef7q/production/517516d65216e9f9c658eb5b8625082f770a11cd-180x180.svg",
  holafly: "https://media.holafly.com/public/favicon/apple-touch-icon.png",
  instabridge: `${MBS}/2024/10/instabridge-esim-logo.png`,
  jambosim: `${MBS}/2026/05/jambosim-esim-logo.png`,
  jetpac: "https://www.jetpacglobal.com/favicon.ico?favicon.fd86eb80.ico",
  mayamobile: "https://assets.maya.net/69dcd6db24fc66cecd1d418a/web/favicon_1773222706182.png",
  nomad: "https://www.nomadesim.com/apple-touch-icon.png?v=2",
  roamic: `${MBS}/2025/11/roamic-esim-logo.png`,
  saily: `${MBS}/2025/08/saily-logo.png`,
  ubigi: "https://www.ubigi.com/wp-content/uploads/2018/05/cropped-cropped-favicon-180x180.png",
  yatelo: `${MBS}/2026/02/yatelo-esim-logo.jpg`,
  yesim: `${MBS}/2025/04/yesim-esim-logo.png`,
};

export const LOGO_SIZE = 64;
const OUT = join(import.meta.dir, "../public/logos");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)";

/** The largest image of an .ico file: a PNG as is, or a 32-bit BMP as raw RGBA pixels. */
export function largestIcoImage(
  buf: Buffer,
): { png: Buffer } | { rgba: Buffer; width: number; height: number } {
  let best = { area: -1, len: 0, off: 0 };
  for (let i = 0; i < buf.readUInt16LE(4); i++) {
    const e = 6 + i * 16;
    const area = (buf[e] || 256) * (buf[e + 1] || 256);
    if (area > best.area)
      best = { area, len: buf.readUInt32LE(e + 8), off: buf.readUInt32LE(e + 12) };
  }
  const data = buf.subarray(best.off, best.off + best.len);
  if (data.readUInt32BE(0) === 0x89504e47) return { png: data };
  const header = data.readUInt32LE(0);
  const width = data.readInt32LE(4);
  const height = data.readInt32LE(8) / 2; // the AND mask doubles the height
  if (data.readUInt16LE(14) !== 32) throw new Error("only 32-bit .ico bitmaps are handled");
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const s = header + ((height - 1 - y) * width + x) * 4; // rows are stored bottom-up, BGRA
      const d = (y * width + x) * 4;
      rgba[d] = data[s + 2];
      rgba[d + 1] = data[s + 1];
      rgba[d + 2] = data[s];
      rgba[d + 3] = data[s + 3];
    }
  return { rgba, width, height };
}

if (import.meta.main) {
  const { default: sharp } = await import("sharp");
  const missing = [...LOGOS].filter((slug) => !SOURCES[slug]);
  if (missing.length) throw new Error(`no source for ${missing.join(", ")}`);
  await mkdir(OUT, { recursive: true });
  for (const [slug, url] of Object.entries(SOURCES)) {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${slug}: HTTP ${res.status} on ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ico = buf.readUInt32LE(0) === 0x00010000 ? largestIcoImage(buf) : null;
    const input =
      ico === null
        ? sharp(buf, { density: 300 })
        : "png" in ico
          ? sharp(ico.png)
          : sharp(ico.rgba, { raw: { width: ico.width, height: ico.height, channels: 4 } });
    const file = join(OUT, `${slug}.webp`);
    await input
      .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 82 })
      .toFile(file);
    console.log(`${slug}: ${(await Bun.file(file).size).toLocaleString("fr-FR")} octets`);
    await Bun.sleep(1000); // one request at a time: some sites block bursts
  }
}
