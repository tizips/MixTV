import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as searchHistoriesRoute from "@/app/api/search/histories/route";
import * as searchHistoryKeywordRoute from "@/app/api/search/histories/[keyword]/route";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  addSearchHistory,
  clearSearchHistory,
  resetSearchHistoryStoreForTest,
} from "@/modules/search/server/search-history-service";
import { createScriptSearchHistoryStore } from "./search-history-test-store";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

async function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

describe("search history API route", () => {
  beforeEach(async () => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user = createScriptSearchHistoryStore();
    resetSearchHistoryStoreForTest();
    await clearSearchHistory("user-1");
    await clearSearchHistory("user-2");
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user;
  });

  it("returns the current search history list", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-1", "沙丘");

    const response = await searchHistoriesRoute.GET();

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ history: ["沙丘", "庆余年"] });
  });

  it("requires authentication for search history", async () => {
    authMock.mockResolvedValue(null);

    const response = await searchHistoriesRoute.GET();

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ message: "Unauthorized." });
  });

  it("does not leak another user's search history", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-2", "沙丘");

    const response = await searchHistoriesRoute.GET();

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ history: ["庆余年"] });
  });

  it("does not expose a POST handler", () => {
    expect("POST" in searchHistoriesRoute).toBe(false);
  });

  it("does not expose a collection DELETE handler", () => {
    expect("DELETE" in searchHistoriesRoute).toBe(false);
  });

  it("deletes a keyword from history", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-1", "沙丘");
    await addSearchHistory("user-2", "庆余年");

    const response = await searchHistoryKeywordRoute.DELETE(
      new Request("http://localhost/api/search/histories/%E5%BA%86%E4%BD%99%E5%B9%B4", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ keyword: "庆余年" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ history: ["沙丘"] });
    authMock.mockResolvedValue({ user: { id: "user-2" } });
    await expect(readJson(await searchHistoriesRoute.GET())).resolves.toEqual({ history: ["庆余年"] });
  });

  it("rejects dynamic delete requests without a keyword", async () => {
    const response = await searchHistoryKeywordRoute.DELETE(
      new Request("http://localhost/api/search/histories/%20%20%20", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ keyword: "   " }) },
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({ message: "keyword is required." });
  });

});
