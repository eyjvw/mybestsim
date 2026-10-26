import { describe, expect, test } from "bun:test";
import { clientKey, MIN_TOKEN_LENGTH, rateLimiter, resolveToken, sameToken } from "./security";

describe("resolveToken", () => {
  test("refuses missing, blank and short tokens", () => {
    expect(resolveToken(undefined)).toBeNull();
    expect(resolveToken("   ")).toBeNull();
    expect(resolveToken("x".repeat(MIN_TOKEN_LENGTH - 1))).toBeNull();
    expect(resolveToken(` ${"x".repeat(MIN_TOKEN_LENGTH)} `)).toBe("x".repeat(MIN_TOKEN_LENGTH));
  });
});

describe("sameToken", () => {
  test("compares any lengths without throwing", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abcd")).toBe(false);
    expect(sameToken("", "abc")).toBe(false);
  });
});

describe("rateLimiter", () => {
  test("blocks a key after its limit until the window ends", () => {
    const rl = rateLimiter(2, 1000);
    expect(rl.blocked("a", 0)).toBe(false);
    rl.hit("a", 0);
    rl.hit("a", 10);
    expect(rl.blocked("a", 20)).toBe(true);
    expect(rl.blocked("b", 20)).toBe(false);
    expect(rl.blocked("a", 1001)).toBe(false);
  });
});

describe("clientKey", () => {
  test("first forwarded address, else the socket", () => {
    const fwd = new Request("http://x", {
      headers: { "X-Forwarded-For": "203.0.113.7, 172.18.0.2" },
    });
    expect(clientKey(fwd, "172.18.0.3")).toBe("203.0.113.7");
    expect(clientKey(new Request("http://x"), "127.0.0.1")).toBe("127.0.0.1");
  });
});
