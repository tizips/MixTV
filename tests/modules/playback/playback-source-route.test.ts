import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/sources/route";

const authMock = vi.hoisted(() => vi.fn());
const getPlaybackSourcesMock = vi.hoisted(() => vi.fn());
const switchPlaybackSourceMock = vi.hoisted(() => vi.fn());
const createPlaybackProgressStoreMock = vi.hoisted(() => vi.fn());
const deleteHistoryPlaybackProgressMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/playback/server/playback-progress-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-progress-service")>();

  return {
    ...actual,
    createPlaybackProgressStore: createPlaybackProgressStoreMock,
  };
});

vi.mock("@/modules/history/server/history-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/history/server/history-service")>();

  return {
    ...actual,
    deleteHistoryPlaybackProgress: deleteHistoryPlaybackProgressMock,
  };
});

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
  const progressStore = {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  };

  const originalStorageType = process.env.STORAGE_TYPE;

  beforeEach(() => {
    authMock.mockReset();
    getPlaybackSourcesMock.mockReset();
    switchPlaybackSourceMock.mockReset();
    createPlaybackProgressStoreMock.mockReset();
    deleteHistoryPlaybackProgressMock.mockReset();
    process.env.STORAGE_TYPE = "upstash";
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalStorageType === undefined) {
      delete process.env.STORAGE_TYPE;
      return;
    }

    process.env.STORAGE_TYPE = originalStorageType;
  });

  it("streams playback source results as SSE", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlaybackSourcesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 1 });
      options.onResult?.({
        id: "80474",
        key: "alpha",
        name: "Alpha Source",
        ping: 72,
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
    expect(body).toContain('"ping":72');
    expect(body).toContain("event: complete");
    expect(getPlaybackSourcesMock).toHaveBeenCalledWith(
      { index: "2026:anime:深空彼岸" },
      expect.objectContaining({
        onResult: expect.any(Function),
        onStart: expect.any(Function),
      }),
    );
  });

  it("streams an error event when playback source lookup times out", async () => {
    vi.useFakeTimers();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlaybackSourcesMock.mockImplementation(async () => new Promise(() => undefined));

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸"));
    const bodyPromise = response.text();

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(bodyPromise).resolves.toContain("event: error");
    await expect(bodyPromise).resolves.toContain("Playback source lookup timed out.");
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });

  it("switches playback sources without reloading the page", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createPlaybackProgressStoreMock.mockReturnValue(progressStore);
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

  it("accepts a JSON body that was stringified twice", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    switchPlaybackSourceMock.mockResolvedValue({
      episodes: [],
      progress: {
        id: "67899",
        play_episodes: 6,
        play_time: 141,
        source: "ikunzy.com",
        total_time: 2173,
      },
      source_name: "Ikun Source",
      sources: [],
    });

    const response = await route.POST(
      new Request("http://localhost/api/play/sources", {
        body: JSON.stringify(
          JSON.stringify({
            currentId: "74183",
            currentSource: "iqiyizyapi.com",
            play_episodes: 6,
            play_time: 141,
            targetId: "67899",
            targetSource: "ikunzy.com",
            total_time: 2173,
          }),
        ),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(switchPlaybackSourceMock).toHaveBeenCalledWith(
      {
        current: { id: "74183", source: "iqiyizyapi.com" },
        play_episodes: 6,
        play_time: 141,
        target: { id: "67899", source: "ikunzy.com" },
        total_time: 2173,
      },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("removes matching history entries for the current playback source after switching playback sources", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createPlaybackProgressStoreMock.mockReturnValue(progressStore);
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
    deleteHistoryPlaybackProgressMock.mockResolvedValue([]);

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
    expect(deleteHistoryPlaybackProgressMock).toHaveBeenCalledTimes(1);
    expect(deleteHistoryPlaybackProgressMock).toHaveBeenCalledWith(
      "user-1",
      { id: "80473", source: "beta" },
      expect.objectContaining({ store: progressStore }),
    );
  });
});
