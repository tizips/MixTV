import { describe, expect, it, vi } from "vitest";
import {
  batchUpdateVideoSources,
  createVideoSource,
  deleteVideoSource,
  getVideoSources,
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
        keys: [created.key],
        patch: { adult: true },
      },
      store,
    );
    expect(batched.sources.find((source) => source.key === created.key)?.adult).toBe(true);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.key, expect.stringContaining('"adult":true')],
      keys: ["sources"],
    });

    const deleted = await deleteVideoSource(created.key, store);
    expect(deleted.sources.some((source) => source.key === created.key)).toBe(false);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HDEL"), {
      args: [created.key],
      keys: ["sources"],
    });
    await expect(getVideoSources(store)).resolves.toEqual(deleted);
  });
});
