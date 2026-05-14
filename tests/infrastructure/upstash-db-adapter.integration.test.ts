import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUpstashDbAdapter, createUpstashRedisClient, seedUpstashDb } from "@/infrastructure/db/upstash-db-adapter";

const redisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const describeIfUpstash = redisRestUrl && redisRestToken ? describe : describe.skip;

describeIfUpstash("upstash db adapter", () => {
  const env = {
    UPSTASH_REDIS_REST_TOKEN: redisRestToken,
    UPSTASH_REDIS_REST_URL: redisRestUrl,
  };
  const namespace = `test:data:${crypto.randomUUID()}`;

  beforeAll(async () => {
    await seedUpstashDb(
      { env, namespace },
      [
        { id: "movie-1", title: "Alpha", score: 8 },
        { id: "movie-2", title: "Beta", score: 6 },
      ],
    );
  });

  afterAll(async () => {
    const client = createUpstashRedisClient({ env });
    await client.del(`${namespace}:item:movie-1`, `${namespace}:item:movie-2`);
  });

  it("sets, gets, and deletes records in upstash", async () => {
    const data = createUpstashDbAdapter<
      { id: string; title: string; score: number }
    >({ env, namespace });

    const initial = await data.get("movie-1");
    expect(initial).toEqual({ id: "movie-1", title: "Alpha", score: 8 });

    await data.set("movie-2", { id: "movie-2", title: "Beta", score: 9 });
    const updated = await data.get("movie-2");
    expect(updated).toEqual({ id: "movie-2", title: "Beta", score: 9 });

    await data.del("movie-1");
    await expect(data.get("movie-1")).resolves.toBeNull();
  });
});
