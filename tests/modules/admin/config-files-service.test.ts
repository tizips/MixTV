import { describe, expect, it, vi } from "vitest";
import {
  readEdgeOneKvJson,
  writeEdgeOneKvJson,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  getConfigFiles,
  getConfigFilesContent,
  getConfigFilesSubscription,
  saveConfigFilesContent,
  saveConfigFilesSubscriptionPull,
  saveConfigFilesSubscription,
  type ConfigFilesContent,
  type ConfigFilesStore,
} from "@/modules/admin/server/config-files-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
  FakeEdgeOneKvBinding,
  seedEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

async function createFakeStore({
  content,
  subscription,
}: {
  content?: ConfigFilesContent;
  subscription?: Record<string, string>;
} = {}): Promise<ConfigFilesStore> {
  const store = new FakeEdgeOneKvBinding();

  if (subscription) {
    await seedEdgeOneKvHash(store, "subscription", subscription, { namespace: "admin" });
  }

  if (content) {
    await writeEdgeOneKvJson(store, "subscriptions", content, { namespace: "admin" });
  }

  return store;
}

function createVideoSourceStore(): Promise<VideoSourceStore> {
  return createEdgeOneKvHashStore({
    sources: {},
  }, { namespace: "admin" });
}

describe("config files service", () => {
  it("reads subscription config from a KV hash", async () => {
    const store = await createFakeStore({
      subscription: {
        autoUpdate: "true",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/sub",
      },
    });

    await expect(getConfigFilesSubscription(store)).resolves.toEqual({
      autoUpdate: true,
      updatedAt: "2026-05-14T00:00:00.000Z",
      url: "https://example.test/sub",
    });
  });

  it("saves subscription config with the store", async () => {
    const store = await createFakeStore();

    const saved = await saveConfigFilesSubscription(
      {
        autoUpdate: true,
        url: " https://example.test/sub ",
      },
      store,
    );

    expect(saved.url).toBe("https://example.test/sub");
    expect(saved.autoUpdate).toBe(true);
    expect(saved.updatedAt).toEqual(expect.any(String));
    await expect(dumpEdgeOneKvHash(store, "subscription", { namespace: "admin" })).resolves.toMatchObject({
      autoUpdate: "true",
      updatedAt: saved.updatedAt,
      url: saved.url,
    });
  });

  it("reads and saves config content as a singleton record", async () => {
    const store = await createFakeStore({
      content: { content: "source=local", updatedAt: "2026-05-14T00:00:00.000Z" },
    });

    await expect(getConfigFilesContent(store)).resolves.toEqual({
      content: "source=local",
      updatedAt: "2026-05-14T00:00:00.000Z",
    });

    const videoSourceStore = await createVideoSourceStore();
    const content = JSON.stringify({ api_site: { local: { api: "https://source.test/api", name: "Local" } } });
    const saved = await saveConfigFilesContent(content, store, videoSourceStore);

    await expect(readEdgeOneKvJson(store, "subscriptions", { namespace: "admin" })).resolves.toEqual({
      content,
      updatedAt: saved.updatedAt,
    });
    await expect(dumpEdgeOneKvHash(videoSourceStore, "sources", { namespace: "admin" })).resolves.toMatchObject({
      local: expect.stringContaining('"apiUrl":"https://source.test/api"'),
    });
  });

  it("reads aggregated config file data", async () => {
    const store = await createFakeStore({
      content: { content: "source=local", updatedAt: "2026-05-14T01:00:00.000Z" },
      subscription: {
        autoUpdate: "false",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/sub",
      },
    });

    await expect(getConfigFiles(store)).resolves.toEqual({
      content: {
        content: "source=local",
        updatedAt: "2026-05-14T01:00:00.000Z",
      },
      subscription: {
        autoUpdate: false,
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/sub",
      },
    });
  });

  it("reads subscription hashes from stored hash values", async () => {
    const store = await createFakeStore({
      subscription: {
        url: "https://example.test/sub",
        autoUpdate: "true",
        updatedAt: "2026-05-14T00:00:00.000Z",
      },
    });

    await expect(getConfigFilesSubscription(store)).resolves.toEqual({
      autoUpdate: true,
      updatedAt: "2026-05-14T00:00:00.000Z",
      url: "https://example.test/sub",
    });
  });

  it("pulls remote subscription and stores decoded config content", async () => {
    const store = await createFakeStore({
      subscription: {
        autoUpdate: "false",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/old",
      },
    });
    const fetchMock = vi.fn(async () => new Response("StV1DL6CwTryKyV", { status: 200 }));
    const videoSourceStore = await createVideoSourceStore();

    const saved = await saveConfigFilesSubscriptionPull(
      "https://example.test/new",
      store,
      fetchMock,
      videoSourceStore,
    );

    expect(saved.url).toBe("https://example.test/new");
    expect(saved.autoUpdate).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/new", {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    await expect(readEdgeOneKvJson<ConfigFilesContent>(store, "subscriptions", { namespace: "admin" })).resolves.toMatchObject({
      content: "hello world",
    });
  });
});
