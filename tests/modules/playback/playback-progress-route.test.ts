import { beforeEach, describe, expect, it, vi } from "vitest";
import * as progressRoute from "@/app/api/playback/progress/[source]/[id]/route";
import { PlaybackProgressValidationError } from "@/modules/playback/server/playback-progress-service";

const authMock = vi.hoisted(() => vi.fn());
const savePlaybackProgressMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/playback/server/playback-progress-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-progress-service")>();

  return {
    ...actual,
    savePlaybackProgress: savePlaybackProgressMock,
  };
});

function mockSession(userId = "user-1") {
  authMock.mockResolvedValue({
    user: {
      id: userId,
    },
  });
}

describe("playback progress API route", () => {
  beforeEach(() => {
    authMock.mockReset();
    savePlaybackProgressMock.mockReset();
  });

  it("updates playback progress for the current user", async () => {
    mockSession();
    savePlaybackProgressMock.mockResolvedValue({
      id: "100",
      index: 2,
      play_time: 1061,
      source: "alpha",
      title: "Alpha Movie",
      total_time: 1247,
    });

    const response = await progressRoute.POST(
      new Request("http://localhost/api/playback/progress/alpha/100", {
        body: JSON.stringify({ index: 2, play_time: 1061, total_time: 1247 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      progress: expect.objectContaining({ id: "100", index: 2, play_time: 1061, source: "alpha" }),
    });
    expect(savePlaybackProgressMock).toHaveBeenCalledWith(
      { id: "100", index: 2, play_time: 1061, source: "alpha", total_time: 1247 },
      { userId: "user-1" },
    );
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await progressRoute.POST(
      new Request("http://localhost/api/playback/progress/alpha/100", {
        body: JSON.stringify({ index: 2, play_time: 1061, total_time: 1247 }),
        method: "POST",
      }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });

  it("rejects invalid JSON", async () => {
    mockSession();

    const response = await progressRoute.POST(
      new Request("http://localhost/api/playback/progress/alpha/100", {
        body: "{",
        method: "POST",
      }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "Request body must be valid JSON." });
  });

  it("returns validation errors as 400 responses", async () => {
    mockSession();
    savePlaybackProgressMock.mockRejectedValue(new PlaybackProgressValidationError("play_time must be non-negative."));

    const response = await progressRoute.POST(
      new Request("http://localhost/api/playback/progress/alpha/100", {
        body: JSON.stringify({ index: 2, play_time: -1, total_time: 1247 }),
        method: "POST",
      }),
      { params: Promise.resolve({ id: "100", source: "alpha" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "play_time must be non-negative." });
  });
});
