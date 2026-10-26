import { createHash, timingSafeEqual } from "node:crypto";

/** Shorter tokens are refused, so a weak or empty value can never unlock publishing. */
export const MIN_TOKEN_LENGTH = 24;

/** The publish token from the environment, or null (publishing off) when missing or too short. */
export function resolveToken(raw: string | undefined): string | null {
  const token = raw?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time comparison; hashing first makes the lengths equal. */
export function sameToken(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/** Fixed-window counter per key, in memory: one ingest process serves the site. */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const live = (key: string, now: number) => {
    const entry = hits.get(key);
    return entry && entry.resetAt > now ? entry : undefined;
  };
  return {
    /** True once `key` has used up its window. */
    blocked: (key: string, now = Date.now()) => (live(key, now)?.count ?? 0) >= limit,
    /** Counts one hit. */
    hit(key: string, now = Date.now()): void {
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      const entry = live(key, now);
      if (entry) entry.count += 1;
      else hits.set(key, { count: 1, resetAt: now + windowMs });
    },
  };
}

/**
 * The client address. Behind the web container's Caddy, X-Forwarded-For starts with the real
 * client (Caddy trusts the VPS proxy on private ranges and appends); otherwise the socket address.
 */
export function clientKey(req: Request, socketAddress: string): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || socketAddress;
}
