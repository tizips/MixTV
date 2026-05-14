import { describe, expect, it, vi } from "vitest";
import type { RedisClientType } from "redis";
import { createRedisDbAdapter } from "@/infrastructure/db/redis-db-adapter";

const createFakeRedisClient = () => ({
  connect: vi.fn(async () => undefined),
  eval: vi.fn(async () => "write-result"),
  evalRo: vi.fn(async () => "read-result"),
  isOpen: false,
});

describe("redis db adapter script", () => {
  it("runs write scripts with namespaced keys and serialized args", async () => {
    const client = createFakeRedisClient();
    const db = createRedisDbAdapter({
      client: client as unknown as RedisClientType,
      namespace: "movies",
    });

    await expect(
      db.script("return ARGV[1]", {
        args: ["alpha", 1, true, null],
        keys: ["item:movie-1"],
      }),
    ).resolves.toBe("write-result");

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.eval).toHaveBeenCalledWith("return ARGV[1]", {
      arguments: ["alpha", "1", "true", ""],
      keys: ["movies:item:movie-1"],
    });
  });

  it("runs read-only scripts through evalRo", async () => {
    const client = createFakeRedisClient();
    const db = createRedisDbAdapter({
      client: client as unknown as RedisClientType,
      namespace: "movies",
    });

    await expect(
      db.script("return KEYS[1]", {
        keys: ["item:movie-1"],
        readOnly: true,
      }),
    ).resolves.toBe("read-result");

    expect(client.evalRo).toHaveBeenCalledWith("return KEYS[1]", {
      arguments: undefined,
      keys: ["movies:item:movie-1"],
    });
  });
});
