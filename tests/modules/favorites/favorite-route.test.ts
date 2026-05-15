import { beforeEach, describe, expect, it, vi } from "vitest";
import * as collectionRoute from "@/app/api/favorites/route";
import * as itemRoute from "@/app/api/favorites/[source]/[id]/route";

const authMock = vi.hoisted(() => vi.fn());
const createFavoriteMock = vi.hoisted(() => vi.fn());
const deleteFavoriteMock = vi.hoisted(() => vi.fn());
const listFavoritesMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/favorites/server/favorite-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/favorites/server/favorite-service")>();

  return {
    ...actual,
    createFavorite: createFavoriteMock,
    deleteFavorite: deleteFavoriteMock,
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

describe("favorite API routes", () => {
  beforeEach(() => {
    authMock.mockReset();
    createFavoriteMock.mockReset();
    deleteFavoriteMock.mockReset();
    listFavoritesMock.mockReset();
  });

  it("creates a favorite through POST /api/favorites/[source]/[id] for the current user", async () => {
    mockSession();
    createFavoriteMock.mockResolvedValue({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      id: "100",
      original_episodes: 3,
      remarks: "更新至3集",
      save_time: 1768435200000,
      search_title: "",
      source: "alpha",
      source_name: "Alpha Source",
      title: "Alpha Movie",
      total_episodes: 3,
      year: "2026",
    });

    const response = await itemRoute.POST(
      new Request("http://localhost/api/favorites/alpha/100", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      favorite: expect.objectContaining({ source: "alpha", id: "100", title: "Alpha Movie" }),
    });
    expect(createFavoriteMock).toHaveBeenCalledWith({ id: "100", source: "alpha" }, { userId: "user-1" });
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await collectionRoute.GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });

  it("lists favorites from GET /api/favorites", async () => {
    mockSession();
    listFavoritesMock.mockResolvedValue([{ id: "100", source: "alpha", title: "Alpha Movie" }]);

    const response = await collectionRoute.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      favorites: [{ id: "100", source: "alpha", title: "Alpha Movie" }],
    });
    expect(listFavoritesMock).toHaveBeenCalledWith("user-1");
  });

  it("deletes a favorite from DELETE /api/favorites/[source]/[id]", async () => {
    mockSession();
    deleteFavoriteMock.mockResolvedValue([]);

    const response = await itemRoute.DELETE(
      new Request("http://localhost/api/favorites/alpha/100", { method: "DELETE" }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ favorites: [] });
    expect(deleteFavoriteMock).toHaveBeenCalledWith("user-1", { id: "100", source: "alpha" });
  });
});
