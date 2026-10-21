/** Fixed-window per-user limiter held in memory; returns a check that is false once the user is over the limit */
export function createRateLimiter(limit: number, windowMs: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();

  // Clean up stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (now > entry.resetAt) entries.delete(key);
    }
  }, 5 * 60_000).unref();

  return (userId: string): boolean => {
    const now = Date.now();
    const entry = entries.get(userId);
    if (!entry || now > entry.resetAt) {
      entries.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}
