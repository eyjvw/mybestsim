import { describe, expect, test } from "bun:test";
import { diffCatalogs } from "./diff";
import { product } from "./fixtures";
import { checkGuard, DEFAULT_GUARD } from "./guard";

const range = (provider: string, n: number) =>
  Array.from({ length: n }, (_, i) => product({ sku: `${provider}-${i}`, provider, price: 10 }));

describe("checkGuard", () => {
  test("normal daily changes pass", () => {
    const base = range("A", 20);
    const head = base.map((p, i) => (i < 3 ? { ...p, price: 14 } : p)).slice(0, 18);
    const g = checkGuard(diffCatalogs(base, head), base);
    expect(g).toEqual({ ok: true, violations: [] });
  });

  test("too many big price moves for one provider are held back", () => {
    const base = [...range("A", 20), ...range("B", 20)];
    // 5 of A's 20 offers (25 %) move by +50 %, B is untouched.
    const head = base.map((p, i) => (i < 5 ? { ...p, price: 15 } : p));
    const g = checkGuard(diffCatalogs(base, head), base);
    expect(g.ok).toBe(false);
    expect(g.violations).toEqual([
      { provider: "A", kind: "price-moves", count: 5, base: 20, share: 0.25 },
    ]);
  });

  test("small moves never count, whatever their number", () => {
    const base = range("A", 20);
    const head = base.map((p) => ({ ...p, price: 11 }));
    expect(checkGuard(diffCatalogs(base, head), base).ok).toBe(true);
  });

  test("a truncated file (most offers removed) is held back", () => {
    const base = range("A", 20);
    const g = checkGuard(diffCatalogs(base, base.slice(0, 8)), base);
    expect(g.violations.map((v) => v.kind)).toEqual(["removed"]);
    expect(g.violations[0].share).toBe(0.6);
  });

  test("small providers and new providers are not checked", () => {
    const base = range("A", 5);
    const head = [...base.map((p) => ({ ...p, price: 50 })), ...range("New", 30)];
    expect(checkGuard(diffCatalogs(base, head), base, DEFAULT_GUARD).ok).toBe(true);
  });
});
