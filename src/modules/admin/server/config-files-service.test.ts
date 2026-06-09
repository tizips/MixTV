import { describe, expect, it, vi } from "vitest";
import {
  readEdgeOneKvJson,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  createEdgeOneKvHashStore,
  FakeEdgeOneKvBinding,
  seedEdgeOneKvHash,
} from "../../../../tests/helpers/fake-edgeone-kv";
import { runConfigFilesSubscriptionAutoUpdate, type ConfigFilesContent } from "./config-files-service";

async function createSubscriptionStore(subscription: Record<string, string>) {
  const store = new FakeEdgeOneKvBinding();
  await seedEdgeOneKvHash(store, "subscription", subscription, { namespace: "admin" });
  return store;
}

function createVideoSourceStore() {
  return createEdgeOneKvHashStore({
    sources: {},
  }, { namespace: "admin" });
}

describe("runConfigFilesSubscriptionAutoUpdate", () => {
  it("skips the update when auto update is disabled", async () => {
    const store = await createSubscriptionStore({
      autoUpdate: "false",
      updatedAt: "2026-05-15T10:20:30.000Z",
      url: "https://example.com/sub.json",
    });
    const fetchMock = vi.fn();
    const videoSourceStore = await createVideoSourceStore();

    const result = await runConfigFilesSubscriptionAutoUpdate(store, fetchMock as never, videoSourceStore);

    expect(result).toEqual({
      subscription: {
        autoUpdate: false,
        updatedAt: "2026-05-15T10:20:30.000Z",
        url: "https://example.com/sub.json",
      },
      updated: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(readEdgeOneKvJson(store, "subscriptions", { namespace: "admin" })).resolves.toBeNull();
  });

  it("pulls the subscription when auto update is enabled", async () => {
    const store = await createSubscriptionStore({
      autoUpdate: "true",
      updatedAt: "2026-05-15T10:20:30.000Z",
      url: "https://example.com/sub.json",
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ api_site: {} }),
    }));
    const videoSourceStore = await createVideoSourceStore();

    const result = await runConfigFilesSubscriptionAutoUpdate(store, fetchMock as never, videoSourceStore);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/sub.json", {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    await expect(readEdgeOneKvJson<ConfigFilesContent>(store, "subscriptions", { namespace: "admin" })).resolves.toEqual({
      content: JSON.stringify({ api_site: {} }),
      updatedAt: expect.any(String),
    });
    expect(result.updated).toBe(true);
    expect(result.subscription.autoUpdate).toBe(true);
    expect(result.subscription.url).toBe("https://example.com/sub.json");
    expect(result.subscription.updatedAt).toEqual(expect.any(String));
  });
});
