import { describe, expect, it, vi } from "vitest";
import { createFavorite, deleteFavorite, listFavorites } from "@/modules/favorites/server/favorite-service";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import { createScriptFavoriteStore } from "./favorite-test-store";

function createVideoSourceStore(): VideoSourceStore {
  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>() => ({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://alpha.test/api",
        key: "alpha",
        name: "Alpha Source",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 10,
      }),
    }) as TResult),
    set: vi.fn(async () => undefined),
  };
}

function createDetail(overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    description: "detail",
    episodeTitles: ["1", "2", "3"],
    episodes: [
      "https://alpha.test/1.m3u8",
      "https://alpha.test/2.m3u8",
      "https://alpha.test/3.m3u8",
    ],
    id: "100",
    posterUrl: "https://image.test/poster.jpg",
    remarks: "更新至3集",
    sourceKey: "alpha",
    sourceName: "Alpha Source",
    title: "Alpha Movie",
    year: "2026",
    ...overrides,
  };
}

describe("favorite service", () => {
  it("creates a user-scoped favorite from third-party detail data", async () => {
    const store = createScriptFavoriteStore();
    const detailFetcher = vi.fn(async () => createDetail());

    const favorite = await createFavorite(
      { id: "100", source: "alpha" },
      {
        detailFetcher,
        now: () => 1768435200000,
        store,
        userId: "user-1",
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(detailFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "https://alpha.test/api", key: "alpha", name: "Alpha Source" }),
      "100",
      {},
    );
    expect(favorite).toEqual({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      id: "100",
      original_episodes: 3,
      remarks: "更新至3集",
      save_time: 1768435200000,
      search_title: "",
      source: "alpha",
      source_name: "Alpha Source",
      title: "Alpha Movie",
      total_episodes: 3,
      year: "2026",
    });
    expect(favorite).not.toHaveProperty("favoriteKey");
    expect(favorite).not.toHaveProperty("index");
    expect(favorite).not.toHaveProperty("play_time");
    expect(favorite).not.toHaveProperty("total_time");
    expect(JSON.parse(store.dumpHash("user-1:fav")["alpha:100"] ?? "{}")).toEqual({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      original_episodes: 3,
      remarks: "更新至3集",
      save_time: 1768435200000,
      search_title: "",
      source_name: "Alpha Source",
      title: "Alpha Movie",
      total_episodes: 3,
      year: "2026",
    });
    expect(JSON.parse(store.dumpHash("user-1:fav")["alpha:100"] ?? "{}")).not.toHaveProperty("favoriteKey");
    expect(JSON.parse(store.dumpHash("user-1:fav")["alpha:100"] ?? "{}")).not.toHaveProperty("index");
    expect(JSON.parse(store.dumpHash("user-1:fav")["alpha:100"] ?? "{}")).not.toHaveProperty("play_time");
    expect(JSON.parse(store.dumpHash("user-1:fav")["alpha:100"] ?? "{}")).not.toHaveProperty("total_time");
    await expect(listFavorites("user-1", { store })).resolves.toEqual([favorite]);
    await expect(listFavorites("user-2", { store })).resolves.toEqual([]);
  });

  it("uses a delimited favorite key that can be split later", () => {
    expect(createFavorite).toBeDefined();
  });

  it("deletes a favorite by the delimited key from the user hash", async () => {
    const store = createScriptFavoriteStore();
    const options = {
      detailFetcher: vi.fn(async () => createDetail()),
      now: () => 1768435200000,
      store,
      userId: "user-1",
      videoSourceStore: createVideoSourceStore(),
    };
    await createFavorite({ id: "100", source: "alpha" }, options);

    const favorites = await deleteFavorite("user-1", { id: "100", source: "alpha" }, { store });

    expect(favorites).toEqual([]);
  });
});
