import { describe, expect, it, vi } from "vitest";
import { runConfigFilesSubscriptionAutoUpdate } from "./config-files-service";

function createSubscriptionStore(subscription: Record<string, string>) {
  return {
    get: vi.fn(),
    del: vi.fn(),
    set: vi.fn(),
    script: vi.fn(async (script: string) => {
      if (script.includes("HGETALL")) {
        return subscription;
      }

      return 1;
    }),
  };
}

function createVideoSourceStore() {
  return {
    get: vi.fn(),
    del: vi.fn(),
    set: vi.fn(),
    script: vi.fn(async (script: string) => {
      if (script.includes("HGETALL")) {
        return {};
      }

      return 1;
    }),
  };
}

describe("runConfigFilesSubscriptionAutoUpdate", () => {
  it("skips the update when auto update is disabled", async () => {
    const store = createSubscriptionStore({
      autoUpdate: "false",
      updatedAt: "2026-05-15T10:20:30.000Z",
      url: "https://example.com/sub.json",
    });
    const fetchMock = vi.fn();
    const videoSourceStore = createVideoSourceStore();

    const result = await runConfigFilesSubscriptionAutoUpdate(store as never, fetchMock as never, videoSourceStore as never);

    expect(result).toEqual({
      subscription: {
        autoUpdate: false,
        updatedAt: "2026-05-15T10:20:30.000Z",
        url: "https://example.com/sub.json",
      },
      updated: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("pulls the subscription when auto update is enabled", async () => {
    const store = createSubscriptionStore({
      autoUpdate: "true",
      updatedAt: "2026-05-15T10:20:30.000Z",
      url: "https://example.com/sub.json",
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ api_site: {} }),
    }));
    const videoSourceStore = createVideoSourceStore();

    const result = await runConfigFilesSubscriptionAutoUpdate(store as never, fetchMock as never, videoSourceStore as never);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/sub.json", {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    expect(store.set).toHaveBeenCalledWith("subscriptions", {
      content: JSON.stringify({ api_site: {} }),
      updatedAt: expect.any(String),
    });
    expect(result.updated).toBe(true);
    expect(result.subscription.autoUpdate).toBe(true);
    expect(result.subscription.url).toBe("https://example.com/sub.json");
    expect(result.subscription.updatedAt).toEqual(expect.any(String));
  });
});
