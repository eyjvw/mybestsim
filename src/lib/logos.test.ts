import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOGO_SIZE, largestIcoImage, SOURCES } from "../../scripts/logos";
import { loadCatalog } from "./load";
import { LOGOS, providerInitials, providerLogo, providerSlug } from "./logos";

const DIR = join(import.meta.dir, "../../public/logos");

describe("provider logos", () => {
  test("slugs ignore case, spaces and accents", () => {
    expect(providerSlug("Maya Mobile")).toBe("mayamobile");
    expect(providerSlug("4S eSIM")).toBe("4sesim");
    expect(providerSlug("aloSIM")).toBe("alosim");
    expect(providerSlug("Télécom Été")).toBe("telecomete");
  });

  test("every provider of the catalog has a logo, except Truphone", () => {
    const providers = [...new Set(loadCatalog().products.map((p) => p.provider))];
    const without = providers.filter((p) => providerLogo(p) === null);
    expect(without).toEqual(["Truphone"]);
    expect(providerLogo("Airalo")).toBe("/logos/airalo.webp");
  });

  test("a new provider added by an import gets initials, not a broken image", () => {
    expect(providerLogo("Nouvel Opérateur")).toBeNull();
    expect(providerInitials("Nouvel Opérateur")).toBe("NO");
    expect(providerInitials("Truphone")).toBe("T");
    expect(providerInitials("  maya  mobile plus ")).toBe("MM");
  });

  test("each logo has a source to regenerate it and a small 64 px WebP file", () => {
    expect(Object.keys(SOURCES).sort()).toEqual([...LOGOS].sort());
    expect(readdirSync(DIR).sort()).toEqual([...LOGOS].map((s) => `${s}.webp`).sort());
    for (const slug of LOGOS) {
      const file = readFileSync(join(DIR, `${slug}.webp`));
      expect(file.subarray(8, 12).toString()).toBe("WEBP");
      expect(file.length).toBeLessThanOrEqual(4096);
    }
    expect(LOGO_SIZE).toBe(64);
    expect(existsSync(join(DIR, "truphone.webp"))).toBe(false);
  });
});

describe("largestIcoImage", () => {
  const entry = (w: number, len: number, off: number) => {
    const e = Buffer.alloc(16);
    e[0] = w;
    e[1] = w;
    e.writeUInt32LE(len, 8);
    e.writeUInt32LE(off, 12);
    return e;
  };

  test("keeps the largest entry and passes a PNG through", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const small = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9]);
    const head = Buffer.from([0, 0, 1, 0, 2, 0]);
    const off = 6 + 32;
    const ico = Buffer.concat([
      head,
      entry(16, small.length, off),
      entry(0, png.length, off + small.length), // 0 means 256 px
      small,
      png,
    ]);
    const out = largestIcoImage(ico);
    expect("png" in out && [...out.png]).toEqual([...png]);
  });

  test("turns a bottom-up BGRA bitmap into top-down RGBA", () => {
    const dib = Buffer.alloc(40 + 2 * 1 * 4);
    dib.writeUInt32LE(40, 0);
    dib.writeInt32LE(1, 4); // 1 px wide
    dib.writeInt32LE(4, 8); // 2 px high, doubled by the AND mask
    dib.writeUInt16LE(32, 14);
    dib.set([1, 2, 3, 255], 40); // bottom row, BGRA
    dib.set([10, 20, 30, 128], 44); // top row
    const ico = Buffer.concat([Buffer.from([0, 0, 1, 0, 1, 0]), entry(1, dib.length, 22), dib]);
    const out = largestIcoImage(ico);
    expect("rgba" in out && { w: out.width, h: out.height, px: [...out.rgba] }).toEqual({
      w: 1,
      h: 2,
      px: [30, 20, 10, 128, 3, 2, 1, 255],
    });
  });
});
