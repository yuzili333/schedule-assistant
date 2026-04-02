interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

export function checkRateLimit(params: {
  key: string;
  now: number;
  windowMs: number;
  maxRequests: number;
}): { allowed: boolean; remaining: number } {
  const existing = buckets.get(params.key);
  if (!existing || existing.expiresAt <= params.now) {
    buckets.set(params.key, {
      count: 1,
      expiresAt: params.now + params.windowMs,
    });
    return {
      allowed: true,
      remaining: params.maxRequests - 1,
    };
  }

  if (existing.count >= params.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  existing.count += 1;
  buckets.set(params.key, existing);
  return {
    allowed: true,
    remaining: params.maxRequests - existing.count,
  };
}
