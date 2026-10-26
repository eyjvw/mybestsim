import { describe, expect, test } from "bun:test";
import { groupBy, mean, median, sum } from "./math";

describe("math", () => {
  test("sum and mean, null mean on empty input", () => {
    expect(sum([1, 2, 3.5])).toBe(6.5);
    expect(mean([2, 4])).toBe(3);
    expect(mean([])).toBeNull();
  });

  test("median of odd, even and empty inputs, without mutating the input", () => {
    const xs = [3, 1, 2];
    expect(median(xs)).toBe(2);
    expect(xs).toEqual([3, 1, 2]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  test("groupBy keeps first-seen key order and item order", () => {
    const g = groupBy(["b1", "a1", "b2"], (s) => s[0]);
    expect([...g.keys()]).toEqual(["b", "a"]);
    expect(g.get("b")).toEqual(["b1", "b2"]);
  });
});
