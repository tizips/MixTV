import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  listSearchHistory,
  resetSearchHistoryStoreForTest,
} from "@/modules/search/server/search-history-service";
import { createScriptSearchHistoryStore } from "./search-history-test-store";

describe("search history service", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user = createScriptSearchHistoryStore();
    resetSearchHistoryStoreForTest();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { user?: EdgeOneKvBinding }).user;
  });

  it("stores search history through the user KV binding", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-1", "沙丘");
    await addSearchHistory("user-1", "庆余年");

    await expect(listSearchHistory("user-1")).resolves.toEqual(["庆余年", "沙丘"]);
  });

  it("separates search history by user", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-2", "沙丘");

    await expect(listSearchHistory("user-1")).resolves.toEqual(["庆余年"]);
    await expect(listSearchHistory("user-2")).resolves.toEqual(["沙丘"]);
  });

  it("deletes and clears keywords from the db list", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-1", "沙丘");

    await expect(deleteSearchHistory("user-1", "庆余年")).resolves.toEqual(["沙丘"]);
    await expect(clearSearchHistory("user-1")).resolves.toEqual([]);
  });
});
