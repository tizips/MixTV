import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/danmaku/route";

const getPlaybackDanmakuMock = vi.hoisted(() => vi.fn());
const getPlaybackDanmakuSegmentMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/playback/server/playback-danmaku-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-danmaku-service")>();

  return {
    ...actual,
    getPlaybackDanmaku: getPlaybackDanmakuMock,
    getPlaybackDanmakuSegment: getPlaybackDanmakuSegmentMock,
  };
});

const validSegment = {
  start: 0,
  end: 60,
  url: "https://youku.test/seg/0",
  type: "youku",
  data: "{\"mat\":0}",
  mH5Tk: "token-0",
  mH5TkEnc: "enc-0",
};

describe("playback danmaku API route", () => {
  beforeEach(() => {
    getPlaybackDanmakuMock.mockReset();
    getPlaybackDanmakuSegmentMock.mockReset();
  });

  it("forwards the title and play_episodes query parameters to the playback danmaku service", async () => {
    getPlaybackDanmakuMock.mockResolvedValue({
      loadMode: "full",
      items: [{ text: "hello", time: 12, mode: 0 }],
      segments: [],
      episodeId: "episode-1",
    });

    const response = await route.GET(
      new Request(
        "http://localhost/api/play/danmaku?title=%E7%A5%9E%E5%A2%93%E5%B9%B4%E7%95%AA&play_episodes=11",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      loadMode: "full",
      items: [{ text: "hello", time: 12, mode: 0 }],
      segments: [],
      episodeId: "episode-1",
    });
    expect(getPlaybackDanmakuMock).toHaveBeenCalledWith({
      title: "神墓年番",
      play_episodes: "11",
    });
  });

  it("rejects segment POST requests with an invalid JSON body", async () => {
    const response = await route.POST(
      new Request("http://localhost/api/play/danmaku", {
        body: "not-json",
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: expect.any(String) });
    expect(getPlaybackDanmakuSegmentMock).not.toHaveBeenCalled();
  });

  it("rejects segment POST requests missing the segment.url field", async () => {
    const response = await route.POST(
      new Request("http://localhost/api/play/danmaku", {
        body: JSON.stringify({ segment: { start: 0, end: 60, type: "youku" } }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: expect.any(String) });
    expect(getPlaybackDanmakuSegmentMock).not.toHaveBeenCalled();
  });

  it("rejects segment POST requests with a non-http segment.url", async () => {
    const response = await route.POST(
      new Request("http://localhost/api/play/danmaku", {
        body: JSON.stringify({ segment: { ...validSegment, url: "ftp://evil.test/seg" } }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: expect.any(String) });
    expect(getPlaybackDanmakuSegmentMock).not.toHaveBeenCalled();
  });

  it("forwards the full segment to the service and returns the items", async () => {
    getPlaybackDanmakuSegmentMock.mockResolvedValue([{ text: "nice", time: 5, mode: 0 }]);

    const response = await route.POST(
      new Request("http://localhost/api/play/danmaku", {
        body: JSON.stringify({ segment: validSegment }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ items: [{ text: "nice", time: 5, mode: 0 }] });
    expect(getPlaybackDanmakuSegmentMock).toHaveBeenCalledWith({ segment: validSegment });
  });
});
