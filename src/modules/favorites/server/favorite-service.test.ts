import { describe, expect, it, vi } from "vitest";
import { createFavorite, type FavoriteServiceOptions } from "./favorite-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
  FakeEdgeOneKvBinding,
} from "../../../../tests/helpers/fake-edgeone-kv";

describe("favorite service", () => {
  it("stores the computed media search index with the favorite record", async () => {
    const store = new FakeEdgeOneKvBinding();
    const videoSourceStore: VideoSourceStore = await createEdgeOneKvHashStore({
      sources: {
        alpha: JSON.stringify({
          adult: false,
          apiUrl: "https://source.test/api",
          key: "alpha",
          name: "Alpha",
          no: 1,
          status: "enabled",
          type: "normal",
          validity: "valid",
          weight: 50,
        }),
      },
    }, { namespace: "admin" });

    const detailFetcher: NonNullable<FavoriteServiceOptions["detailFetcher"]> = vi.fn(async () => ({
      className: "电视剧",
      description: "desc",
      episodes: ["https://media.test/1.m3u8"],
      id: "movie-1",
      posterUrl: "https://image.test/poster.jpg",
      remarks: "",
      sourceKey: "alpha",
      sourceName: "电影天堂资源",
      title: "庆余年 第二季",
      typeName: "电视剧",
      year: "2024",
    }));

    const favorite = await createFavorite(
      { id: "movie-1", source: "alpha" },
      {
        detailFetcher,
        store,
        userId: "user-1",
        videoSourceStore,
      } satisfies FavoriteServiceOptions,
    );

    expect(favorite).toMatchObject({
      id: "movie-1",
      index: "2024:tv:庆余年第二季",
      source: "alpha",
    });

    await expect(dumpEdgeOneKvHash(store, "user-1:fav", { namespace: "user" })).resolves.toMatchObject({
      "alpha:movie-1": expect.stringContaining('"index":"2024:tv:庆余年第二季"'),
    });
  });
});
