import { describe, expect, it, vi } from "vitest";
import {
  createRedisClient,
  createRedisDbAdapter,
  disconnectRedisDb,
  seedRedisDb,
  type RedisClient,
} from "@/infrastructure/db/redis-db-adapter";

vi.mock("redis", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "redis";

const createFakeRedisClient = (): RedisClient => ({
  connect: vi.fn(async () => {}),
  del: vi.fn(async () => 1),
  eval: vi.fn(async () => "eval-result"),
  get: vi.fn(async () => null),
  isOpen: false,
  quit: vi.fn(async () => "OK"),
  set: vi.fn(async () => "OK"),
});

describe("redis db adapter", () => {
  it("creates a redis client from REDIS_URL", () => {
    vi.mocked(createClient).mockReturnValueOnce({} as never);

    createRedisClient({
      env: {
        REDIS_URL: "redis://127.0.0.1:6379",
      },
    });

    expect(createClient).toHaveBeenCalledWith({
      url: "redis://127.0.0.1:6379",
    });
  });

  it("rejects http redis urls", () => {
    expect(() =>
      createRedisClient({
        env: {
          REDIS_URL: "https://redis.example.test",
        },
      }),
    ).toThrow('REDIS_URL must start with redis:// or rediss://. Received "https://redis.example.test".');
  });

  it("sets, gets, deletes and scripts with namespaced keys", async () => {
    const client = createFakeRedisClient();
    vi.mocked(client.get).mockResolvedValueOnce(JSON.stringify({ id: "movie-1", title: "Alpha" }));
    const db = createRedisDbAdapter<{ id: string; title: string }>({
      client,
      namespace: "movies",
    });

    await db.set("movie-1", { id: "movie-1", title: "Alpha" });
    await expect(db.get("movie-1")).resolves.toEqual({ id: "movie-1", title: "Alpha" });
    await db.del("movie-1");
    await expect(
      db.script("return ARGV[1]", {
        args: ["alpha", 1, true, null],
        keys: ["item:movie-1"],
      }),
    ).resolves.toBe("eval-result");

    expect(client.connect).toHaveBeenCalledTimes(4);
    expect(client.set).toHaveBeenCalledWith(
      "movies:item:movie-1",
      JSON.stringify({ id: "movie-1", title: "Alpha" }),
    );
    expect(client.get).toHaveBeenCalledWith("movies:item:movie-1");
    expect(client.del).toHaveBeenCalledWith("movies:item:movie-1");
    expect(client.eval).toHaveBeenCalledWith("return ARGV[1]", {
      arguments: ["alpha", "1", "true", ""],
      keys: ["movies:item:movie-1"],
    });
  });

  it("disconnects open client", async () => {
    const client = createFakeRedisClient();
    client.isOpen = true;

    await disconnectRedisDb(client);

    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it("seeds redis records", async () => {
    const client = createFakeRedisClient();
    const db = createRedisDbAdapter<{ id: string; title: string }>({
      client,
      namespace: "movies",
    });

    await seedRedisDb(
      { client, namespace: "movies" },
      [
        { id: "1", title: "A" },
        { id: "2", title: "B" },
      ],
    );

    expect(db).toBeDefined();
    expect(client.set).toHaveBeenNthCalledWith(1, "movies:item:1", JSON.stringify({ id: "1", title: "A" }));
    expect(client.set).toHaveBeenNthCalledWith(2, "movies:item:2", JSON.stringify({ id: "2", title: "B" }));
  });
});
