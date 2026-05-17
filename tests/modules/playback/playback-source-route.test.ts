import { describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/sources/route";

const authMock = vi.hoisted(() => vi.fn());
const getPlaybackSourcesMock = vi.hoisted(() => vi.fn());
const switchPlaybackSourceMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/playback/server/playback-source-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-source-service")>();

  return {
    ...actual,
    getPlaybackSources: getPlaybackSourcesMock,
  };
});

vi.mock("@/modules/playback/server/playback-source-switch-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-source-switch-service")>();

  return {
    ...actual,
    switchPlaybackSource: switchPlaybackSourceMock,
  };
});

describe("playback source API route", () => {
  it("streams playback source results as SSE", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlaybackSourcesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 1 });
      options.onResult?.({
        id: "80474",
        key: "alpha",
        name: "Alpha Source",
        quality: "1080P",
        source_name: "Alpha Source",
        total_episodes: 2,
      });
      return { completed: 1, total: 1 };
    });

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: start");
    expect(body).toContain('"total":1');
    expect(body).toContain("event: result");
    expect(body).toContain('"key":"alpha"');
    expect(body).toContain("event: complete");
    expect(getPlaybackSourcesMock).toHaveBeenCalledWith(
      { index: "2026:anime:深空彼岸" },
      expect.objectContaining({
        onResult: expect.any(Function),
        onStart: expect.any(Function),
      }),
    );
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });

  it("switches playback sources without reloading the page", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    switchPlaybackSourceMock.mockResolvedValue({
      episodes: [
        { duration: "未知", number: 1, title: "第1集" },
        { duration: "未知", number: 2, title: "第2集" },
      ],
      progress: {
        id: "80474",
        play_episodes: 2,
        play_time: 125,
        source: "alpha",
        total_time: 2708,
      },
      source_name: "Alpha Source",
      sources: [
        {
          id: "episode-1",
          latency: "在线播放",
          name: "第1集",
          quality: "HLS",
          status: "流畅",
          url: "https://media.test/1.m3u8",
        },
        {
          id: "episode-2",
          latency: "在线播放",
          name: "第2集",
          quality: "HLS",
          status: "流畅",
          url: "https://media.test/2.m3u8",
        },
      ],
    });

    const response = await route.POST(
      new Request("http://localhost/api/play/sources", {
        body: JSON.stringify({
          currentId: "80473",
          currentSource: "beta",
          play_episodes: 2,
          play_time: 125,
          targetId: "80474",
          targetSource: "alpha",
          total_time: 2708,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      progress: { id: "80474", play_episodes: 2, play_time: 125, source: "alpha" },
      source_name: "Alpha Source",
    });
    expect(switchPlaybackSourceMock).toHaveBeenCalledWith(
      {
        current: { id: "80473", source: "beta" },
        play_episodes: 2,
        play_time: 125,
        target: { id: "80474", source: "alpha" },
        total_time: 2708,
      },
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});
