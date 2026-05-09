// src/infrastructure/storage/memory-storage-adapter.ts
import type { StoragePort } from "@/shared/storage/storage-port";

export const createMemoryStorageAdapter = (): StoragePort => {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
};
