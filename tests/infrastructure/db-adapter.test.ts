import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDbAdapter,
  resolveStorageType,
} from "@/infrastructure/db/db-adapter";
import { createRedisDbAdapter } from "@/infrastructure/db/redis-db-adapter";
import { createUpstashDbAdapter } from "@/infrastructure/db/upstash-db-adapter";

vi.mock("@/infrastructure/db/redis-db-adapter", () => ({
  createRedisDbAdapter: vi.fn(() => ({
    del: vi.fn(),
    get: vi.fn(),
    script: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock("@/infrastructure/db/upstash-db-adapter", () => ({
  createUpstashDbAdapter: vi.fn(() => ({
    del: vi.fn(),
    get: vi.fn(),
    script: vi.fn(),
    set: vi.fn(),
  })),
}));

describe("db adapter factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes explicit upstash STORAGE_TYPE", () => {
    expect(resolveStorageType({ STORAGE_TYPE: " Upstash " })).toBe("upstash");
  });

  it("rejects unsupported STORAGE_TYPE values", () => {
    expect(() => resolveStorageType({ STORAGE_TYPE: "memory" })).toThrow(
      'Unsupported STORAGE_TYPE "memory". Supported values: redis, upstash',
    );
  });

  it("normalizes explicit redis STORAGE_TYPE", () => {
    expect(resolveStorageType({ STORAGE_TYPE: " Redis " })).toBe("redis");
  });

  it("creates the upstash db adapter with env defaults", () => {
    const adapter = createDbAdapter<{ id: string; title: string }>({
      env: {
        STORAGE_TYPE: "upstash",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      },
      namespace: "movies",
    });

    expect(adapter).toBeDefined();
    expect(createUpstashDbAdapter).toHaveBeenCalledWith({
      client: undefined,
      env: {
        STORAGE_TYPE: "upstash",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      },
      namespace: "movies",
      token: undefined,
      url: "https://redis.example.test",
    });
  });

  it("creates the redis db adapter lazily with env defaults", async () => {
    const adapter = createDbAdapter<{ id: string; title: string }>({
      env: {
        REDIS_URL: "redis://127.0.0.1:6379",
        STORAGE_TYPE: "redis",
      },
      namespace: "movies",
    });

    expect(adapter).toBeDefined();
    expect(createRedisDbAdapter).not.toHaveBeenCalled();

    await adapter.get("movie-1");

    expect(createRedisDbAdapter).toHaveBeenCalledWith({
      client: undefined,
      env: {
        REDIS_URL: "redis://127.0.0.1:6379",
        STORAGE_TYPE: "redis",
      },
      namespace: "movies",
      url: "redis://127.0.0.1:6379",
    });
  });

  it("lets an explicit url override env.REDIS_URL", () => {
    createDbAdapter<{ id: string }>({
      env: {
        REDIS_URL: "https://env.test",
        STORAGE_TYPE: "upstash",
      },
      namespace: "movies",
      url: "https://override.test",
    });

    expect(createUpstashDbAdapter).toHaveBeenCalledWith({
      client: undefined,
      env: {
        REDIS_URL: "https://env.test",
        STORAGE_TYPE: "upstash",
      },
      namespace: "movies",
      token: undefined,
      url: "https://override.test",
    });
  });

});
