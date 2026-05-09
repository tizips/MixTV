// tests/infrastructure/memory-adapters.test.ts
import { describe, expect, it } from "vitest";
import { createMemoryStorageAdapter } from "@/infrastructure/storage/memory-storage-adapter";
import { createMemoryCacheAdapter } from "@/infrastructure/cache/memory-cache-adapter";

describe("memory adapters", () => {
  it("stores and reads storage values", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.set("k1", { ok: true });
    const value = await storage.get<{ ok: boolean }>("k1");
    expect(value).toEqual({ ok: true });
  });

  it("invalidates cache values", async () => {
    const cache = createMemoryCacheAdapter();
    await cache.set("k1", 123, 60);
    await cache.invalidate("k1");
    const value = await cache.get<number>("k1");
    expect(value).toBeNull();
  });
});
