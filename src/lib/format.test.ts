import { describe, expect, test } from "bun:test";
import { product } from "./fixtures";
import {
  formatEur,
  formatEurPerGb,
  formatEurRound,
  formatGb,
  formatInt,
  formatPct,
  formatTier,
  planLabel,
  rangeLabel,
} from "./format";

// fr-FR uses narrow no-break spaces; normalise them so the assertions stay readable.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("format", () => {
  test("French number formats", () => {
    expect(plain(formatEur(29.3))).toBe("29,30 €");
    expect(plain(formatInt(5056))).toBe("5 056");
    expect(plain(formatGb(14.49))).toBe("14,49 Go");
    expect(plain(formatPct(0.129))).toBe("12,9 %");
    expect(plain(formatEurPerGb(2.5))).toBe("2,50 €/Go");
    expect(plain(formatEurRound(1584))).toBe("1 584 €");
    expect(plain(formatEurRound(969.6))).toBe("970 €");
  });

  test("dash for missing values, Illimité for unlimited", () => {
    for (const f of [formatEur, formatEurRound, formatInt, formatGb, formatPct, formatEurPerGb])
      expect(f(null)).toBe("—");
    expect(formatTier(null)).toBe("Illimité");
    expect(formatTier(20)).toBe("20 Go");
  });

  test("plan and price range labels", () => {
    const cheap = product({
      countryName: "Irlande",
      dataGb: 1,
      validityDays: 7,
      provider: "aloSIM",
    });
    const dear = product({
      countryName: "Europe",
      dataGb: null,
      validityDays: 30,
      provider: "aloSIM",
    });
    expect(planLabel(dear)).toBe("Europe Illimité 30 j");
    expect(rangeLabel(cheap, dear)).toBe("Irlande 1 Go 7 j → Europe Illimité 30 j, chez aloSIM");
    expect(rangeLabel(cheap, { ...dear, provider: "Ubigi" })).toBe(
      "Irlande 1 Go 7 j (aloSIM) → Europe Illimité 30 j (Ubigi)",
    );
  });
});
