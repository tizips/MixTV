import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDbAdapter, resolveStorageType } from "@/infrastructure/db/db-adapter";
import { createRedisDbAdapter } from "@/infrastructure/db/redis-db-adapter";

vi.mock("@/infrastructure/db/redis-db-adapter", () => ({
  createRedisDbAdapter: vi.fn(() => ({
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

describe("db adapter factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults STORAGE_TYPE to redis", () => {
    expect(resolveStorageType({})).toBe("redis");
  });

  it("normalizes explicit redis STORAGE_TYPE", () => {
    expect(resolveStorageType({ STORAGE_TYPE: " Redis " })).toBe("redis");
  });

  it("rejects unsupported STORAGE_TYPE values", () => {
    expect(() => resolveStorageType({ STORAGE_TYPE: "memory" })).toThrow(
      'Unsupported STORAGE_TYPE "memory". Supported values: redis',
    );
  });

  it("creates the redis db adapter with env defaults", () => {
    const adapter = createDbAdapter<{ id: string; title: string }>({
      env: {
        REDIS_URL: "redis://example.test:6379",
        STORAGE_TYPE: "redis",
      },
      namespace: "movies",
    });

    expect(adapter).toBeDefined();
    expect(createRedisDbAdapter).toHaveBeenCalledWith({
      client: undefined,
      namespace: "movies",
      url: "redis://example.test:6379",
    });
  });

  it("lets an explicit url override env.REDIS_URL", () => {
    createDbAdapter<{ id: string }>({
      env: {
        REDIS_URL: "redis://env.test:6379",
      },
      namespace: "movies",
      url: "redis://override.test:6379",
    });

    expect(createRedisDbAdapter).toHaveBeenCalledWith({
      client: undefined,
      namespace: "movies",
      url: "redis://override.test:6379",
    });
  });
});
