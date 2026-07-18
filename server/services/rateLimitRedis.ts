/**
 * Optional Redis-backed rate-limit store for express-rate-limit.
 * Falls back to in-memory when REDIS_URL is unset or Redis is unreachable.
 */
import type { Store } from "express-rate-limit";

type RedisClient = {
  incr(key: string): Promise<number>;
  pExpire(key: string, ms: number): Promise<boolean>;
  pTTL(key: string): Promise<number>;
};

let redis: RedisClient | null = null;
let initAttempted = false;

async function getRedis(): Promise<RedisClient | null> {
  if (initAttempted) return redis;
  initAttempted = true;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    client.on("error", () => {
      /* keep process alive — memory fallback on ops */
    });
    await client.connect();
    redis = client as unknown as RedisClient;
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

export function createRateLimitStore(windowMs: number): Store {
  const prefix = "circled:rl:";
  const memory = new Map<string, { count: number; reset: number }>();

  return {
    async increment(key: string) {
      const full = prefix + key;
      const r = await getRedis();
      if (r) {
        try {
          const count = await r.incr(full);
          if (count === 1) await r.pExpire(full, windowMs);
          const ttl = await r.pTTL(full);
          return {
            totalHits: count,
            resetTime: new Date(Date.now() + Math.max(ttl, 0)),
          };
        } catch {
          /* fall through */
        }
      }
      const now = Date.now();
      const cur = memory.get(full);
      if (!cur || cur.reset <= now) {
        const reset = now + windowMs;
        memory.set(full, { count: 1, reset });
        return { totalHits: 1, resetTime: new Date(reset) };
      }
      cur.count += 1;
      return { totalHits: cur.count, resetTime: new Date(cur.reset) };
    },
    async decrement(key: string) {
      const full = prefix + key;
      const cur = memory.get(full);
      if (cur && cur.count > 0) cur.count -= 1;
    },
    async resetKey(key: string) {
      memory.delete(prefix + key);
    },
  };
}
