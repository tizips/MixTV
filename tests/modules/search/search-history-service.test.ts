import { beforeEach, describe, expect, it, vi } from "vitest";

const createDbAdapterMock = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/db/db-adapter", () => ({
  createDbAdapter: createDbAdapterMock,
}));

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
    createDbAdapterMock.mockReset();
    createDbAdapterMock.mockReturnValue(createScriptSearchHistoryStore());
    resetSearchHistoryStoreForTest();
  });

  it("stores search history through the db script adapter", async () => {
    await addSearchHistory("user-1", "庆余年");
    await addSearchHistory("user-1", "沙丘");
    await addSearchHistory("user-1", "庆余年");

    await expect(listSearchHistory("user-1")).resolves.toEqual(["庆余年", "沙丘"]);
    expect(createDbAdapterMock).toHaveBeenCalledWith({ namespace: "user" });
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
