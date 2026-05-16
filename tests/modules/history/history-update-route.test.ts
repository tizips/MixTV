import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/history/check-updates/route";

const authMock = vi.hoisted(() => vi.fn());
const checkHistoryUpdatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/history/server/history-update-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/history/server/history-update-service")>();

  return {
    ...actual,
    checkHistoryUpdates: checkHistoryUpdatesMock,
  };
});

function mockSession(userId = "user-1") {
  authMock.mockResolvedValue({
    user: {
      id: userId,
    },
  });
}

describe("history update check route", () => {
  beforeEach(() => {
    authMock.mockReset();
    checkHistoryUpdatesMock.mockReset();
  });

  it("streams SSE events from the update checker", async () => {
    mockSession();
    checkHistoryUpdatesMock.mockImplementation(async function* () {
      yield { type: "start", total: 1 };
      yield {
        id: "100",
        newTotalEpisodes: 14,
        oldTotalEpisodes: 12,
        source: "alpha",
        type: "update",
        updated: true,
      };
      yield { type: "done", checked: 1, errors: 0, skipped: 0, updated: 1 };
    });

    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain('event: update');
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });
});
