import { describe, expect, it } from "vitest";
import { saveMediaSearchCacheEntries } from "./media-search-cache-service";
import {
  dumpEdgeOneKvHash,
  FakeEdgeOneKvBinding,
} from "../../../../tests/helpers/fake-edgeone-kv";

describe("media search cache service", () => {
  it("stores results in a source hash with episode count and a one hour ttl", async () => {
    const store = new FakeEdgeOneKvBinding();

    await saveMediaSearchCacheEntries(
      "2024:tv:庆余年第二季",
      [
        {
          id: "movie-1",
          quality: "1080p",
          resourceKey: "alpha",
          name: "电影天堂资源",
          total_episodes: 12,
        },
      ],
      { store },
    );

    await expect(dumpEdgeOneKvHash(store, "2024:tv:庆余年第二季")).resolves.toEqual({
      alpha: JSON.stringify({
        id: "movie-1",
        name: "电影天堂资源",
        quality: "1080p",
        total_episodes: 12,
      }),
    });
  });
});
