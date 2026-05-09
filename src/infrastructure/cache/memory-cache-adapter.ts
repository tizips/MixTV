// src/infrastructure/cache/memory-cache-adapter.ts
import type { CachePort } from "@/shared/cache/cache-port";

export const createMemoryCacheAdapter = (): CachePort => {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async invalidate(key: string): Promise<void> {
      store.delete(key);
    },
  };
};
