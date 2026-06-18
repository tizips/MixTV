import { describe, expect, it, vi } from "vitest";
import { saveMediaSearchCacheEntries, type MediaSearchCacheStore } from "./media-search-cache-service";

describe("media search cache service", () => {
  it("stores results in a source hash with episode count and a one hour ttl", async () => {
    const script = vi.fn(async () => undefined) as unknown as MediaSearchCacheStore["script"];
    const store = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script,
      set: vi.fn(async () => undefined),
    } satisfies MediaSearchCacheStore;

    await saveMediaSearchCacheEntries(
      "2024:tv:庆余年第二季",
      [
        {
          id: "movie-1",
          quality: "1080p",
          resourceKey: "alpha",
          name: "电影天堂资源",
          ping: 64,
          total_episodes: 12,
        },
      ],
      { store },
    );

    expect(script).toHaveBeenCalledTimes(1);
    expect(script).toHaveBeenCalledWith(
      expect.any(String),
      {
        args: [
          "alpha",
          JSON.stringify({
            id: "movie-1",
            quality: "1080p",
            name: "电影天堂资源",
            ping: 64,
            total_episodes: 12,
          }),
          3600,
        ],
        keys: ["2024:tv:庆余年第二季"],
      },
    );
  });
});
