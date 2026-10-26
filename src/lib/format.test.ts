import { describe, expect, test } from "bun:test";
import { formatEur, formatEurPerGb, formatGb, formatInt, formatPct, formatTier } from "./format";

// fr-FR uses narrow no-break spaces; normalise them so the assertions stay readable.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("format", () => {
  test("French number formats", () => {
    expect(plain(formatEur(29.3))).toBe("29,30 €");
    expect(plain(formatInt(5056))).toBe("5 056");
    expect(plain(formatGb(14.49))).toBe("14,49 Go");
    expect(plain(formatPct(0.129))).toBe("12,9 %");
    expect(plain(formatEurPerGb(2.5))).toBe("2,50 €/Go");
  });

  test("dash for missing values, Illimité for unlimited", () => {
    for (const f of [formatEur, formatInt, formatGb, formatPct, formatEurPerGb])
      expect(f(null)).toBe("—");
    expect(formatTier(null)).toBe("Illimité");
    expect(formatTier(20)).toBe("20 Go");
  });
});
