import { beforeEach, describe, expect, it, vi } from "vitest";
import * as collectionRoute from "@/app/api/history/route";
import * as itemRoute from "@/app/api/history/[source]/[id]/route";

const authMock = vi.hoisted(() => vi.fn());
const deleteHistoryMock = vi.hoisted(() => vi.fn());
const listHistoryMock = vi.hoisted(() => vi.fn());
const listFavoritesMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/history/server/history-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/history/server/history-service")>();

  return {
    ...actual,
    deleteHistoryPlaybackProgress: deleteHistoryMock,
    listPlaybackHistory: listHistoryMock,
  };
});

vi.mock("@/modules/favorites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/favorites")>();

  return {
    ...actual,
    listFavorites: listFavoritesMock,
  };
});

function mockSession(userId = "user-1") {
  authMock.mockResolvedValue({
    user: {
      id: userId,
    },
  });
}

describe("history API routes", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteHistoryMock.mockReset();
    listHistoryMock.mockReset();
    listFavoritesMock.mockReset();
  });

  it("lists history from GET /api/history", async () => {
    mockSession();
    listHistoryMock.mockResolvedValue([{ id: "100", source: "alpha", title: "Alpha Movie" }]);
    listFavoritesMock.mockResolvedValue([]);

    const response = await collectionRoute.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      history: [{ id: "100", source: "alpha", title: "Alpha Movie", is_favorite: false }],
    });
    expect(listHistoryMock).toHaveBeenCalledWith("user-1");
    expect(listFavoritesMock).toHaveBeenCalledWith("user-1");
  });

  it("deletes a history entry from DELETE /api/history/[source]/[id]", async () => {
    mockSession();
    deleteHistoryMock.mockResolvedValue([]);
    listFavoritesMock.mockResolvedValue([]);

    const response = await itemRoute.DELETE(
      new Request("http://localhost/api/history/alpha/100", { method: "DELETE" }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ history: [] });
    expect(deleteHistoryMock).toHaveBeenCalledWith("user-1", { id: "100", source: "alpha" });
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);
    listFavoritesMock.mockResolvedValue([]);

    const response = await collectionRoute.GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });
});
