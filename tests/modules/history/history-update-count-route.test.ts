import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/history/update-count/route";

const authMock = vi.hoisted(() => vi.fn());
const countHistoryUpdatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/history", () => ({
  countHistoryUpdates: countHistoryUpdatesMock,
}));

function mockSession(userId = "user-1") {
  authMock.mockResolvedValue({
    user: {
      id: userId,
    },
  });
}

describe("history update count route", () => {
  beforeEach(() => {
    authMock.mockReset();
    countHistoryUpdatesMock.mockReset();
  });

  it("returns the history update count", async () => {
    mockSession();
    countHistoryUpdatesMock.mockResolvedValue({ history: 4 });

    const response = await route.GET(new Request("http://localhost/api/history/update-count"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ history: 4 });
    expect(countHistoryUpdatesMock).toHaveBeenCalledWith("user-1");
  });

  it("returns the user id in debug mode", async () => {
    mockSession("admin");
    countHistoryUpdatesMock.mockResolvedValue({ history: 4 });

    const response = await route.GET(new Request("http://localhost/api/history/update-count?debug=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ history: 4, userId: "admin" });
    expect(countHistoryUpdatesMock).toHaveBeenCalledWith("admin");
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET(new Request("http://localhost/api/history/update-count"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });
});
