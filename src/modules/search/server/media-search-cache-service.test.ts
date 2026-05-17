import { describe, expect, it, vi } from "vitest";
import { saveMediaSearchCacheEntries, type MediaSearchCacheStore } from "./media-search-cache-service";

describe("media search cache service", () => {
  it("stores results in a source hash with a seven day ttl", async () => {
    const script = vi.fn(async () => undefined);
    const store = { script } satisfies Pick<MediaSearchCacheStore, "script">;

    await saveMediaSearchCacheEntries(
      "2024:tv:庆余年第二季",
      [
        {
          id: "movie-1",
          quality: "1080p",
          resourceKey: "alpha",
          name: "电影天堂资源",
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
          }),
          604800,
        ],
        keys: ["2024:tv:庆余年第二季"],
      },
    );
  });
});
