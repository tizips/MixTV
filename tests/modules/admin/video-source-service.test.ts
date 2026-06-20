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

const createFakeStore = (initial: Record<string, string> = {}): VideoSourceStore => {
  const hash = new Map(Object.entries(initial));

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>(script: string, options = {}) => {
      const runOptions = options as { args?: unknown[] };

      if (script.includes("HGETALL")) {
        return Object.fromEntries(hash) as TResult;
      }

      if (script.includes("HSET")) {
        const [key, rawSource] = runOptions.args ?? [];

        if (typeof key === "string" && typeof rawSource === "string") {
          hash.set(key, rawSource);
        }

        return 1 as TResult;
      }

      if (script.includes("HDEL")) {
        const [key] = runOptions.args ?? [];

        if (typeof key === "string") {
          hash.delete(key);
        }

        return 1 as TResult;
      }

      return {} as TResult;
    }) as VideoSourceStore["script"],
    set: vi.fn(async () => undefined),
  };
};

describe("video source service", () => {
  it("reads video sources from the sources redis hash", async () => {
    const store = createFakeStore();

    await getVideoSources(store);

    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["sources"],
      readOnly: true,
    });
  });

  it("returns no default video sources before any sources are saved", async () => {
    const store = createFakeStore();

    await expect(getVideoSources(store)).resolves.toEqual({ sources: [], updatedAt: null });
  });

  it("removes legacy source ids when reading stored video sources", async () => {
    const store = createFakeStore({
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
    const store = createFakeStore({
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

  it("creates, updates, batch updates, and deletes video sources through redis hash commands", async () => {
    const store = createFakeStore();
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
    expect(store.set).not.toHaveBeenCalledWith("sources", expect.anything());
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.key, expect.not.stringContaining('"id"')],
      keys: ["sources"],
    });

    const updated = await updateVideoSource(created.key, { status: "disabled", weight: 10 }, store);
    expect(updated.sources.find((source) => source.key === created.key)?.status).toBe("disabled");
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.key, expect.stringContaining('"status":"disabled"')],
      keys: ["sources"],
    });

    const batched = await batchUpdateVideoSources(
      {
        action: "enable",
        keys: [created.key],
      },
      store,
    );
    expect(batched.sources.find((source) => source.key === created.key)?.status).toBe("enabled");
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.key, expect.stringContaining('"status":"enabled"')],
      keys: ["sources"],
    });

    await expect(updateVideoSource(created.key, { key: "renamed-source" }, store)).rejects.toThrow(
      "source key cannot be changed.",
    );

    const deleted = await deleteVideoSource(created.key, store);
    expect(deleted.sources.some((source) => source.key === created.key)).toBe(false);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HDEL"), {
      args: [created.key],
      keys: ["sources"],
    });
    await expect(getVideoSources(store)).resolves.toEqual(deleted);
  });

  it("checks every stored video source with one keyword and persists each validity result", async () => {
    const store = createFakeStore({
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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["alpha", expect.stringContaining('"validity":"valid"')],
      keys: ["sources"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["beta", expect.stringContaining('"validity":"invalid"')],
      keys: ["sources"],
    });
  });

  it("deletes invalid video sources when configured to remove failed checks", async () => {
    const store = createFakeStore({
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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HDEL"), {
      args: ["beta"],
      keys: ["sources"],
    });
    expect(store.script).not.toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["beta", expect.anything()],
      keys: ["sources"],
    });
  });

  it("checks every video source while limiting concurrent validity requests", async () => {
    const store = createFakeStore(
      Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => {
          const no = index + 1;
          const key = `source-${no.toString().padStart(2, "0")}`;

          return [
            key,
            JSON.stringify({
              adult: false,
              apiUrl: `https://${key}.test/api`,
              key,
              name: `Source ${no}`,
              no,
              status: "enabled",
              type: "normal",
              updatedAt: null,
              validity: "warning",
              weight: 10,
            }),
          ];
        }),
      ),
    );
    const releaseFetches: Array<() => void> = [];
    const waitForTasks = () => new Promise((resolve) => setTimeout(resolve, 0));
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releaseFetches.push(() => resolve(new Response(JSON.stringify({ list: [{ vod_name: "Movie" }] }), { status: 200 })));
        }),
    );

    const checkPromise = checkVideoSourceValidities(
      { keyword: "movie" },
      {
        concurrency: 10,
        fetcher,
        store,
      },
    );

    await waitForTasks();
    expect(fetcher).toHaveBeenCalledTimes(10);

    releaseFetches.splice(0).forEach((releaseFetch) => releaseFetch());
    await waitForTasks();
    expect(fetcher).toHaveBeenCalledTimes(12);

    releaseFetches.splice(0).forEach((releaseFetch) => releaseFetch());
    const checked = await checkPromise;

    expect(checked.sources.map((source) => source.key)).toEqual([
      "source-01",
      "source-02",
      "source-03",
      "source-04",
      "source-05",
      "source-06",
      "source-07",
      "source-08",
      "source-09",
      "source-10",
      "source-11",
      "source-12",
    ]);
  });

  it("syncs config api_site entries into video sources without changing existing source flags", async () => {
    const store = createFakeStore({
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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["alpha", expect.stringContaining('"apiUrl":"https://new.test/api"')],
      keys: ["sources"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["beta", expect.stringContaining('"status":"enabled"')],
      keys: ["sources"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["removed", expect.stringContaining('"no":0')],
      keys: ["sources"],
    });
  });
});
