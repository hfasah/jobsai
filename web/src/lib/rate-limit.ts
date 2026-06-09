// Lightweight in-memory IP rate limiter — no dependencies, no Redis.
// Good enough for launch; swap for Upstash Redis when traffic warrants it.
//
// Each limiter instance tracks its own window independently, so you can have
// different limits for different endpoint groups.
//
// NOTE: in-memory = per-process. On Vercel's serverless each cold-start gets a
// fresh counter, which slightly under-counts in theory but is still effective
// against sustained abuse (attackers need to sustain > limit * cold-start-rate).

interface Entry { count: number; reset: number }

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function createRateLimiter(opts: {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}) {
  const store = new Map<string, Entry>();

  // Prune stale entries every ~5 minutes to prevent unbounded memory growth.
  let lastPrune = Date.now();
  function maybePrune() {
    const now = Date.now();
    if (now - lastPrune < 5 * 60_000) return;
    lastPrune = now;
    for (const [key, entry] of store) {
      if (now > entry.reset) store.delete(key);
    }
  }

  return function check(ip: string): RateLimitResult {
    maybePrune();
    const now = Date.now();
    let entry = store.get(ip);
    if (!entry || now > entry.reset) {
      entry = { count: 1, reset: now + opts.windowMs };
      store.set(ip, entry);
      return { ok: true, remaining: opts.limit - 1, retryAfterSec: 0 };
    }
    entry.count++;
    if (entry.count > opts.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.ceil((entry.reset - now) / 1000),
      };
    }
    return { ok: true, remaining: opts.limit - entry.count, retryAfterSec: 0 };
  };
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(req: { headers: { get: (h: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Standard 429 response with Retry-After header. */
export function tooManyRequests(retryAfterSec: number) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
