import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type RedisClientType } from "redis";
import { createRedisDbAdapter, seedRedisDb } from "@/infrastructure/db/redis-db-adapter";

const redisUrl = process.env.REDIS_URL;
const describeIfRedis = redisUrl ? describe : describe.skip;

describeIfRedis("redis db adapter", () => {
  let client: RedisClientType;
  const namespace = `test:data:${randomUUID()}`;

  beforeAll(async () => {
    client = createClient({ url: redisUrl });
    await client.connect();

    await seedRedisDb(
      { client, namespace },
      [
        { id: "movie-1", title: "Alpha", score: 8 },
        { id: "movie-2", title: "Beta", score: 6 },
      ],
    );
  });

  afterAll(async () => {
    if (!client?.isOpen) {
      return;
    }

    await client.del([`${namespace}:item:movie-1`, `${namespace}:item:movie-2`]);
    await client.quit();
  });

  it("sets, gets, and deletes records in redis", async () => {
    const data = createRedisDbAdapter<
      { id: string; title: string; score: number }
    >({ client, namespace });

    const initial = await data.get("movie-1");
    expect(initial).toEqual({ id: "movie-1", title: "Alpha", score: 8 });

    await data.set("movie-2", { id: "movie-2", title: "Beta", score: 9 });
    const updated = await data.get("movie-2");
    expect(updated).toEqual({ id: "movie-2", title: "Beta", score: 9 });

    await data.del("movie-1");
    await expect(data.get("movie-1")).resolves.toBeNull();
  });
});
