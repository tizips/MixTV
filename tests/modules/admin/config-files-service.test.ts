import { describe, expect, it, vi } from "vitest";
import {
  getConfigFiles,
  getConfigFilesContent,
  getConfigFilesSubscription,
  saveConfigFilesContent,
  saveConfigFilesSubscriptionPull,
  saveConfigFilesSubscription,
  type ConfigFilesStore,
} from "@/modules/admin/server/config-files-service";

const createScriptMock = (result: unknown = {}) =>
  vi.fn(async <TResult = unknown>() => result as TResult) as unknown as ConfigFilesStore["script"];

const createFakeStore = (overrides: Partial<ConfigFilesStore> = {}): ConfigFilesStore => ({
  del: vi.fn(async () => undefined),
  get: vi.fn(async () => null),
  script: createScriptMock(),
  set: vi.fn(async () => undefined),
  ...overrides,
});

describe("config files service", () => {
  it("reads subscription config from a redis hash", async () => {
    const store = createFakeStore({
      script: createScriptMock({
        autoUpdate: "true",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/sub",
      }),
    });

    await expect(getConfigFilesSubscription(store)).resolves.toEqual({
      autoUpdate: true,
      updatedAt: "2026-05-14T00:00:00.000Z",
      url: "https://example.test/sub",
    });

    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["subscription"],
      readOnly: true,
    });
  });

  it("saves subscription config with the store", async () => {
    const store = createFakeStore();

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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [saved.url, saved.autoUpdate, saved.updatedAt],
      keys: ["subscription"],
    });
  });

  it("reads and saves config content as a singleton record", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({ content: "source=local", updatedAt: "2026-05-14T00:00:00.000Z" })),
    });

    await expect(getConfigFilesContent(store)).resolves.toEqual({
      content: "source=local",
      updatedAt: "2026-05-14T00:00:00.000Z",
    });

    const saved = await saveConfigFilesContent("source=remote", store);

    expect(store.get).toHaveBeenCalledWith("content");
    expect(store.set).toHaveBeenCalledWith("content", {
      content: "source=remote",
      updatedAt: saved.updatedAt,
    });
  });

  it("reads aggregated config file data", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({ content: "source=local", updatedAt: "2026-05-14T01:00:00.000Z" })),
      script: createScriptMock({
        autoUpdate: "false",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/sub",
      }),
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

    expect(store.get).toHaveBeenCalledWith("content");
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["subscription"],
      readOnly: true,
    });
  });

  it("reads subscription hashes returned as hgetall arrays", async () => {
    const store = createFakeStore({
      script: createScriptMock([
        "url",
        "https://example.test/sub",
        "autoUpdate",
        "true",
        "updatedAt",
        "2026-05-14T00:00:00.000Z",
      ]),
    });

    await expect(getConfigFilesSubscription(store)).resolves.toEqual({
      autoUpdate: true,
      updatedAt: "2026-05-14T00:00:00.000Z",
      url: "https://example.test/sub",
    });
  });

  it("pulls remote subscription and stores decoded config content", async () => {
    const store = createFakeStore({
      script: createScriptMock({
        autoUpdate: "false",
        updatedAt: "2026-05-14T00:00:00.000Z",
        url: "https://example.test/old",
      }),
    });
    const fetchMock = vi.fn(async () => new Response("StV1DL6CwTryKyV", { status: 200 }));

    const saved = await saveConfigFilesSubscriptionPull("https://example.test/new", store, fetchMock);

    expect(saved.url).toBe("https://example.test/new");
    expect(saved.autoUpdate).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/new", {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    expect(store.set).toHaveBeenCalledWith(
      "content",
      expect.objectContaining({
        content: "hello world",
      }),
    );
  });
});
