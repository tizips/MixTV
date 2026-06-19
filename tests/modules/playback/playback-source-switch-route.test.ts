import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/source-switch/route";

const authMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/modules/playback/server/playback-source-switch-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-source-switch-service")>();

  return {
    ...actual,
    switchPlaybackSource: switchPlaybackSourceMock,
  };
});

vi.mock("@/modules/stats", () => ({
  recordApiRequest: vi.fn(),
}));

describe("playback source switch API route", () => {
  const progressStore = {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  };

  const originalStorageType = process.env.STORAGE_TYPE;

  beforeEach(() => {
    authMock.mockReset();
    switchPlaybackSourceMock.mockReset();
    createPlaybackProgressStoreMock.mockReset();
    deleteHistoryPlaybackProgressMock.mockReset();
    process.env.STORAGE_TYPE = "upstash";
  });

  afterEach(() => {
    if (originalStorageType === undefined) {
      delete process.env.STORAGE_TYPE;
      return;
    }

    process.env.STORAGE_TYPE = originalStorageType;
  });

  it("uses the Node.js runtime for source switching", () => {
    expect(route.runtime).toBe("nodejs");
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.POST(
      new Request("http://localhost/api/play/source-switch", {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );

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
      new Request("http://localhost/api/play/source-switch", {
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

  it("accepts the playback source switch payload sent by the player", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    switchPlaybackSourceMock.mockResolvedValue({
      episodes: [],
      progress: {
        id: "82236",
        play_episodes: 10,
        play_time: 752,
        source: "dyttzyapi.com",
        total_time: 1074,
      },
      source_name: "Dytt Source",
      sources: [],
    });

    const payload = {
      currentId: "79126",
      currentSource: "iqiyizyapi.com",
      play_episodes: 10,
      play_time: 752,
      targetId: "82236",
      targetSource: "dyttzyapi.com",
      total_time: 1074,
    };
    const request = new Request("http://localhost/api/play/source-switch", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const json = vi.fn(async () => payload);
    Object.defineProperty(request, "json", { value: json });

    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect(json).toHaveBeenCalledTimes(1);
    expect(switchPlaybackSourceMock).toHaveBeenCalledWith(
      {
        current: { id: "79126", source: "iqiyizyapi.com" },
        play_episodes: 10,
        play_time: 752,
        target: { id: "82236", source: "dyttzyapi.com" },
        total_time: 1074,
      },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("reads the playback source switch payload with request json exactly once", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    switchPlaybackSourceMock.mockResolvedValue({
      episodes: [],
      progress: {
        id: "82236",
        play_episodes: 10,
        play_time: 752,
        source: "dyttzyapi.com",
        total_time: 1074,
      },
      source_name: "Dytt Source",
      sources: [],
    });
    const payload = {
      currentId: "79126",
      currentSource: "iqiyizyapi.com",
      play_episodes: 10,
      play_time: 752,
      targetId: "82236",
      targetSource: "dyttzyapi.com",
      total_time: 1074,
    };
    const request = {
      headers: new Headers({ "Content-Type": "application/json" }),
      json: vi.fn(async () => payload),
      method: "POST",
      url: "http://localhost/api/play/source-switch",
    } as unknown as Request;

    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect((request as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalledTimes(1);
    expect(switchPlaybackSourceMock).toHaveBeenCalledWith(
      {
        current: { id: "79126", source: "iqiyizyapi.com" },
        play_episodes: 10,
        play_time: 752,
        target: { id: "82236", source: "dyttzyapi.com" },
        total_time: 1074,
      },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("passes the parsed playback source switch payload through authentication without reading it again", async () => {
    let authWasCalled = false;
    authMock.mockImplementation(async () => {
      authWasCalled = true;
      return { user: { id: "user-1" } };
    });
    switchPlaybackSourceMock.mockResolvedValue({
      episodes: [],
      progress: {
        id: "82236",
        play_episodes: 10,
        play_time: 752,
        source: "dyttzyapi.com",
        total_time: 1074,
      },
      source_name: "Dytt Source",
      sources: [],
    });
    const payload = {
      currentId: "79126",
      currentSource: "iqiyizyapi.com",
      play_episodes: 10,
      play_time: 752,
      targetId: "82236",
      targetSource: "dyttzyapi.com",
      total_time: 1074,
    };
    const request = {
      headers: new Headers({ "Content-Type": "application/json" }),
      json: vi.fn(async () => {
        if (authWasCalled) {
          throw new TypeError("Body is unusable");
        }

        return payload;
      }),
      method: "POST",
      url: "http://localhost/api/play/source-switch",
    } as unknown as Request;

    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect((request as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalledTimes(1);
    expect(switchPlaybackSourceMock).toHaveBeenCalledWith(
      {
        current: { id: "79126", source: "iqiyizyapi.com" },
        play_episodes: 10,
        play_time: 752,
        target: { id: "82236", source: "dyttzyapi.com" },
        total_time: 1074,
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
      new Request("http://localhost/api/play/source-switch", {
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
