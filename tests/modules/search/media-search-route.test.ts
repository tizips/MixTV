import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as searchHistoriesRoute from "@/app/api/search/histories/route";
import * as mediaSearchRoute from "@/app/api/search/media/route";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  clearSearchHistory,
  resetSearchHistoryStoreForTest,
} from "@/modules/search/server/search-history-service";
import { createScriptSearchHistoryStore } from "./search-history-test-store";

const searchMediaSourcesMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());
const ensureEdgeOneKvBindingsForNodeMock = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/edgeone/node-kv-bindings", () => ({
  ensureEdgeOneKvBindingsForNode: ensureEdgeOneKvBindingsForNodeMock,
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/search/server/media-search-service", () => ({
  MediaSearchValidationError: class MediaSearchValidationError extends Error {},
  searchMediaSources: searchMediaSourcesMock,
}));

describe("media search API route", () => {
  beforeEach(async () => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    ensureEdgeOneKvBindingsForNodeMock.mockReset();
    searchMediaSourcesMock.mockReset();
    (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user = createScriptSearchHistoryStore();
    resetSearchHistoryStoreForTest();
    await clearSearchHistory("user-1");
    await clearSearchHistory("user-2");
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user;
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await mediaSearchRoute.GET(new Request("http://localhost/api/search/media?q=movie"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
    expect(searchMediaSourcesMock).not.toHaveBeenCalled();
  });

  it("requires a query", async () => {
    const response = await mediaSearchRoute.GET(new Request("http://localhost/api/search/media"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "q is required." });
  });

  it("streams media search results as SSE", async () => {
    searchMediaSourcesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 1 });
      options.onResult?.({
        results: [
          {
            total_episodes: 1,
            cover: "",
            id: "1",
            idx: "title:alphamovie:year:2026",
            key: "alpha",
            quality: "1080P",
            source_name: "Alpha",
            source_total: 2,
            title: "Alpha Movie",
            year: "2026",
          },
        ],
        source: {
          adult: false,
          apiUrl: "https://source.test/api",
          key: "alpha",
          name: "Alpha",
          no: 1,
          status: "enabled",
          type: "normal",
          updatedAt: null,
          validity: "valid",
          weight: 10,
        },
      });
      return { completed: 1, total: 1 };
    });

    const response = await mediaSearchRoute.GET(new Request("http://localhost/api/search/media?q=movie"));
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(body).toContain("event: start");
    expect(body).toContain('"total":1');
    expect(body).toContain("event: result");
    expect(body).toContain('data: [{"total_episodes":1');
    expect(body).not.toContain('"results":[');
    expect(body).not.toContain('"source":{');
    expect(body).not.toContain('"sourceCount"');
    expect(body).not.toContain('"sources"');
    expect(body).not.toContain('"playUrl"');
    expect(body).not.toContain('"episodeCount"');
    expect(body).not.toContain('"posterUrl"');
    expect(body).not.toContain('"resourceId"');
    expect(body).not.toContain('"resource_id"');
    expect(body).not.toContain('"sourceName"');
    expect(body).toContain('"quality":"1080P"');
    expect(body).toContain('"source_total":2');
    expect(body).toContain('"idx":"title:alphamovie:year:2026"');
    expect(body).toContain('"id":"1"');
    expect(body).toContain('"key":"alpha"');
    expect(body).toContain("event: complete");
    expect(searchMediaSourcesMock).toHaveBeenCalledWith(
      { query: "movie" },
      expect.objectContaining({
        maxPages: 1,
        onResult: expect.any(Function),
        onStart: expect.any(Function),
        timeoutMs: expect.any(Number),
      }),
    );
    expect(ensureEdgeOneKvBindingsForNodeMock).toHaveBeenCalled();

    const historyResponse = await searchHistoriesRoute.GET();

    await expect(historyResponse.json()).resolves.toEqual({ history: ["movie"] });
  });

  it("does not stream an error when one source reports an empty failed result", async () => {
    searchMediaSourcesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 2 });
      options.onResult?.({
        results: [],
        source: { key: "failed", name: "Failed" },
      });
      options.onResult?.({
        results: [
          {
            total_episodes: 1,
            cover: "",
            id: "1",
            idx: "title:alphamovie:year:2026",
            key: "alpha",
            quality: "1080P",
            source_name: "Alpha",
            source_total: 1,
            title: "Alpha Movie",
            year: "2026",
          },
        ],
        source: { key: "alpha", name: "Alpha" },
      });
      return { completed: 2, total: 2 };
    });

    const response = await mediaSearchRoute.GET(new Request("http://localhost/api/search/media?q=movie"));
    const body = await response.text();

    expect(body).toContain("event: result");
    expect(body).toContain('"title":"Alpha Movie"');
    expect(body).toContain("event: complete");
    expect(body).not.toContain("event: error");
    expect(body).not.toContain("This operation was aborted");
  });

  it("stores search history under the current user only", async () => {
    searchMediaSourcesMock.mockResolvedValue({ completed: 0, total: 0 });

    await mediaSearchRoute.GET(new Request("http://localhost/api/search/media?q=movie"));

    authMock.mockResolvedValue({ user: { id: "user-2" } });
    await expect((await searchHistoriesRoute.GET()).json()).resolves.toEqual({ history: [] });
  });
});
