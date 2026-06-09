import { describe, expect, it, vi } from "vitest";
import {
  batchUpdateVideoSources,
  checkVideoSourceValidities,
  createVideoSource,
  deleteVideoSource,
  getVideoSources,
  syncVideoSourcesFromConfigContent,
  updateVideoSource,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const videoSourcesKey = "sources";

function createFakeStore(initial: Record<string, string> = {}): Promise<VideoSourceStore> {
  return createEdgeOneKvHashStore({
    [videoSourcesKey]: initial,
  }, { namespace: "admin" });
}

describe("video source service", () => {
  it("reads video sources from the sources KV hash", async () => {
    const store = await createFakeStore();

    await expect(getVideoSources(store)).resolves.toEqual({ sources: [], updatedAt: null });
  });

  it("returns no default video sources before any sources are saved", async () => {
    const store = await createFakeStore();

    await expect(getVideoSources(store)).resolves.toEqual({ sources: [], updatedAt: null });
  });

  it("removes legacy source ids when reading stored video sources", async () => {
    const store = await createFakeStore({
      legacy: JSON.stringify({
        adult: false,
        apiUrl: "https://legacy.test/api",
        id: "legacy-id",
        key: "legacy",
        name: "Legacy Source",
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 10,
      }),
    });

    const data = await getVideoSources(store);

    expect(data.sources[0]).not.toHaveProperty("id");
    expect(data.sources[0]).toMatchObject({ key: "legacy", name: "Legacy Source" });
  });

  it("sorts video sources by subscription number first and moves zero numbers last", async () => {
    const store = await createFakeStore({
      disabled: JSON.stringify({
        adult: false,
        apiUrl: "https://disabled.test/api",
        key: "disabled",
        name: "Disabled",
        no: 0,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 1,
      }),
      first: JSON.stringify({
        adult: false,
        apiUrl: "https://first.test/api",
        key: "first",
        name: "First",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 99,
      }),
      second: JSON.stringify({
        adult: false,
        apiUrl: "https://second.test/api",
        key: "second",
        name: "Second",
        no: 2,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 2,
      }),
      unnumbered: JSON.stringify({
        adult: false,
        apiUrl: "https://unnumbered.test/api",
        key: "unnumbered",
        name: "Unnumbered",
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 1,
      }),
    });

    const data = await getVideoSources(store);

    expect(data.sources.map((source) => source.key)).toEqual(["first", "second", "disabled", "unnumbered"]);
  });

  it("creates, updates, batch updates, and deletes video sources through the KV hash", async () => {
    const store = await createFakeStore();
    const created = await createVideoSource(
      {
        adult: false,
        apiUrl: " https://source.test/api ",
        key: "new-source",
        name: " New Source ",
        status: "enabled",
        type: "normal",
        weight: 150,
      },
      store,
    );

    expect(created).not.toHaveProperty("id");
    expect(created.key).toBe("new-source");
    expect(created.weight).toBe(99);
    expect(created.validity).toBe("warning");
    let sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash[created.key]).not.toContain('"id"');

    const updated = await updateVideoSource(created.key, { status: "disabled", weight: 10 }, store);
    expect(updated.sources.find((source) => source.key === created.key)?.status).toBe("disabled");
    sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash[created.key]).toContain('"status":"disabled"');

    const batched = await batchUpdateVideoSources(
      {
        action: "enable",
        keys: [created.key],
      },
      store,
    );
    expect(batched.sources.find((source) => source.key === created.key)?.status).toBe("enabled");
    sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash[created.key]).toContain('"status":"enabled"');

    await expect(updateVideoSource(created.key, { key: "renamed-source" }, store)).rejects.toThrow(
      "source key cannot be changed.",
    );

    const deleted = await deleteVideoSource(created.key, store);
    expect(deleted.sources.some((source) => source.key === created.key)).toBe(false);
    sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash[created.key]).toBeUndefined();
    await expect(getVideoSources(store)).resolves.toEqual(deleted);
  });

  it("checks every stored video source with one keyword and persists each validity result", async () => {
    const store = await createFakeStore({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://alpha.test/api",
        key: "alpha",
        name: "Alpha",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
      beta: JSON.stringify({
        adult: false,
        apiUrl: "https://beta.test/api",
        key: "beta",
        name: "Beta",
        no: 2,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
    });
    const events: Array<{ key: string; validity: "valid" | "invalid" }> = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ list: [{ vod_name: "Alpha Movie" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ list: [] }), { status: 200 }));

    const checked = await checkVideoSourceValidities(
      { keyword: "movie" },
      {
        fetcher,
        onResult: (result) => events.push({ key: result.key, validity: result.validity }),
        store,
      },
    );

    expect(fetcher).toHaveBeenNthCalledWith(1, "https://alpha.test/api?wd=movie", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://beta.test/api?wd=movie", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(events).toEqual([
      { key: "alpha", validity: "valid" },
      { key: "beta", validity: "invalid" },
    ]);
    expect(checked.sources.find((source) => source.key === "alpha")?.validity).toBe("valid");
    expect(checked.sources.find((source) => source.key === "beta")?.validity).toBe("invalid");
    const sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash.alpha).toContain('"validity":"valid"');
    expect(sourcesHash.beta).toContain('"validity":"invalid"');
  });

  it("checks video source validities concurrently to avoid long route runs", async () => {
    const store = await createFakeStore({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://alpha.test/api",
        key: "alpha",
        name: "Alpha",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
      beta: JSON.stringify({
        adult: false,
        apiUrl: "https://beta.test/api",
        key: "beta",
        name: "Beta",
        no: 2,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
      gamma: JSON.stringify({
        adult: false,
        apiUrl: "https://gamma.test/api",
        key: "gamma",
        name: "Gamma",
        no: 3,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
    });
    let activeFetches = 0;
    let maxActiveFetches = 0;
    const fetcher = vi.fn(async () => {
      activeFetches += 1;
      maxActiveFetches = Math.max(maxActiveFetches, activeFetches);

      await new Promise((resolve) => setTimeout(resolve, 10));

      activeFetches -= 1;
      return new Response(JSON.stringify({ list: [{ vod_name: "Movie" }] }), { status: 200 });
    });

    await checkVideoSourceValidities(
      { keyword: "movie" },
      {
        fetcher,
        store,
      },
    );

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(maxActiveFetches).toBeGreaterThan(1);
  });

  it("deletes invalid video sources when configured to remove failed checks", async () => {
    const store = await createFakeStore({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://alpha.test/api",
        key: "alpha",
        name: "Alpha",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
      beta: JSON.stringify({
        adult: false,
        apiUrl: "https://beta.test/api",
        key: "beta",
        name: "Beta",
        no: 2,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "warning",
        weight: 10,
      }),
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ list: [{ vod_name: "Alpha Movie" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ list: [] }), { status: 200 }));

    const checked = await checkVideoSourceValidities(
      { keyword: "movie" },
      {
        fetcher,
        removeInvalidSources: true,
        store,
      },
    );

    expect(checked.sources.map((source) => source.key)).toEqual(["alpha"]);
    const sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash.beta).toBeUndefined();
  });

  it("syncs config api_site entries into video sources without changing existing source flags", async () => {
    const store = await createFakeStore({
      alpha: JSON.stringify({
        adult: true,
        apiUrl: "https://old.test/api",
        key: "alpha",
        name: "Old Alpha",
        no: 8,
        status: "disabled",
        type: "short-drama",
        updatedAt: "2026-05-14T00:00:00.000Z",
        validity: "valid",
        weight: 88,
      }),
      removed: JSON.stringify({
        adult: false,
        apiUrl: "https://removed.test/api",
        key: "removed",
        name: "Removed",
        no: 9,
        status: "enabled",
        type: "normal",
        updatedAt: "2026-05-14T00:00:00.000Z",
        validity: "valid",
        weight: 1,
      }),
    });

    const synced = await syncVideoSourcesFromConfigContent(
      JSON.stringify({
        api_site: {
          alpha: {
            api: " https://new.test/api ",
            name: " New Alpha ",
          },
          beta: {
            api: "https://beta.test/api",
            name: "🔞 Beta",
          },
        },
      }),
      store,
    );

    expect(synced.sources.find((source) => source.key === "alpha")).toMatchObject({
      adult: true,
      apiUrl: "https://new.test/api",
      key: "alpha",
      name: "New Alpha",
      no: 1,
      status: "disabled",
      type: "short-drama",
      updatedAt: "2026-05-14T00:00:00.000Z",
      validity: "valid",
      weight: 88,
    });
    expect(synced.sources.find((source) => source.key === "beta")).toMatchObject({
      adult: true,
      apiUrl: "https://beta.test/api",
      key: "beta",
      name: "🔞 Beta",
      no: 2,
      status: "enabled",
      type: "normal",
      validity: "warning",
      weight: 50,
    });
    expect(synced.sources.find((source) => source.key === "removed")).toMatchObject({
      key: "removed",
      no: 0,
    });
    const sourcesHash = await dumpEdgeOneKvHash(store, videoSourcesKey, { namespace: "admin" });
    expect(sourcesHash.alpha).toContain('"apiUrl":"https://new.test/api"');
    expect(sourcesHash.beta).toContain('"status":"enabled"');
    expect(sourcesHash.removed).toContain('"no":0');
  });
});
