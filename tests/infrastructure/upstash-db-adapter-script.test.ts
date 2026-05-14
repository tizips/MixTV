import { describe, expect, it, vi } from "vitest";
import {
  createUpstashDbAdapter,
  createUpstashRedisClient,
  type UpstashRedisClient,
} from "@/infrastructure/db/upstash-db-adapter";

const createFakeRedisClient = (): UpstashRedisClient => ({
  del: vi.fn(async () => 1),
  eval: vi.fn(async () => "write-result"),
  evalRo: vi.fn(async () => "read-result"),
  get: vi.fn(async () => null),
  set: vi.fn(async () => "OK"),
});

describe("upstash db adapter script", () => {
  it("sets, gets, and deletes records through upstash redis", async () => {
    const client = createFakeRedisClient();
    vi.mocked(client.get).mockResolvedValueOnce(JSON.stringify({ id: "movie-1", title: "Alpha" }));
    const db = createUpstashDbAdapter<{ id: string; title: string }>({
      client,
      namespace: "movies",
    });

    await db.set("movie-1", { id: "movie-1", title: "Alpha" });
    await expect(db.get("movie-1")).resolves.toEqual({ id: "movie-1", title: "Alpha" });
    await db.del("movie-1");

    expect(client.set).toHaveBeenCalledWith(
      "movies:movie-1",
      JSON.stringify({ id: "movie-1", title: "Alpha" }),
    );
    expect(client.get).toHaveBeenCalledWith("movies:movie-1");
    expect(client.del).toHaveBeenCalledWith("movies:movie-1");
  });

  it("runs write scripts with namespaced keys and serialized args", async () => {
    const client = createFakeRedisClient();
    const db = createUpstashDbAdapter({
      client,
      namespace: "movies",
    });

    await expect(
      db.script("return ARGV[1]", {
        args: ["alpha", 1, true, null],
        keys: ["movie-1"],
      }),
    ).resolves.toBe("write-result");

    expect(client.eval).toHaveBeenCalledWith(
      "return ARGV[1]",
      ["movies:movie-1"],
      ["alpha", "1", "true", ""],
    );
  });

  it("runs read-only scripts through evalRo", async () => {
    const client = createFakeRedisClient();
    const db = createUpstashDbAdapter({
      client,
      namespace: "movies",
    });

    await expect(
      db.script("return KEYS[1]", {
        keys: ["movie-1"],
        readOnly: true,
      }),
    ).resolves.toBe("read-result");

    expect(client.evalRo).toHaveBeenCalledWith(
      "return KEYS[1]",
      ["movies:movie-1"],
      [],
    );
  });

  it("creates an upstash redis client from Upstash env names", async () => {
    const client = createUpstashRedisClient({
      env: {
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      },
    });

    expect(client).toEqual(expect.objectContaining({
      del: expect.any(Function),
      eval: expect.any(Function),
      evalRo: expect.any(Function),
      get: expect.any(Function),
      set: expect.any(Function),
    }));
  });

  it("rejects raw redis tcp urls", () => {
    expect(() =>
      createUpstashRedisClient({
        env: {
          UPSTASH_REDIS_REST_TOKEN: "test-token",
          UPSTASH_REDIS_REST_URL: "127.0.0.1:6379",
        },
      }),
    ).toThrow(
      'Redis REST URL must start with http:// or https://. Received "127.0.0.1:6379". Raw Redis TCP URLs are not supported in Edge-compatible routes.',
    );
  });
});
