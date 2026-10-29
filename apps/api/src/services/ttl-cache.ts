/**
 * Values built per key at most once every `ttlMs`, in this process. Callers asking while a build runs share it; a build
 * that fails is dropped, so the next caller tries again.
 */
export function ttlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, build: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const value = build();
      entries.set(key, { at: now(), value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    },
    delete(key: string) {
      entries.delete(key);
    },
  };
}
