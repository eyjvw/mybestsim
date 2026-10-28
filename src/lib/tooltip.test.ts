import { describe, expect, test } from "bun:test";
import { nextIndex, offersLabel, tooltipAlign } from "./tooltip";

describe("tooltipAlign", () => {
  test("edge columns anchor to their side, the others are centred", () => {
    expect([0, 1, 2, 13, 14, 15].map((i) => tooltipAlign(i, 16))).toEqual([
      "start",
      "start",
      "center",
      "center",
      "end",
      "end",
    ]);
  });

  test("a chart of a few columns keeps every tooltip centred", () => {
    expect([0, 1, 2, 3].map((i) => tooltipAlign(i, 4))).toEqual([
      "center",
      "center",
      "center",
      "center",
    ]);
  });
});

describe("offersLabel", () => {
  test("singular up to 1, plural from 2, with the given number format", () => {
    expect(offersLabel(0)).toBe("0 offre");
    expect(offersLabel(1)).toBe("1 offre");
    expect(offersLabel(2)).toBe("2 offres");
    expect(offersLabel(1605, (n) => `<${n}>`)).toBe("<1605> offres");
  });
});

describe("nextIndex", () => {
  test("arrows step without leaving the chart, Home and End jump", () => {
    expect(nextIndex("ArrowRight", 3, 16)).toBe(4);
    expect(nextIndex("ArrowRight", 15, 16)).toBe(15);
    expect(nextIndex("ArrowLeft", 0, 16)).toBe(0);
    expect(nextIndex("ArrowDown", 5, 16)).toBe(4);
    expect(nextIndex("Home", 9, 16)).toBe(0);
    expect(nextIndex("End", 2, 16)).toBe(15);
  });

  test("other keys and an empty chart are left alone", () => {
    expect(nextIndex("Enter", 3, 16)).toBeNull();
    expect(nextIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
