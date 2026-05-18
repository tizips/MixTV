import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/danmaku/route";

const getPlaybackDanmakuMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/playback/server/playback-danmaku-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-danmaku-service")>();

  return {
    ...actual,
    getPlaybackDanmaku: getPlaybackDanmakuMock,
  };
});

describe("playback danmaku API route", () => {
  beforeEach(() => {
    getPlaybackDanmakuMock.mockReset();
  });

  it("forwards the title and play_episodes query parameters to the playback danmaku service", async () => {
    getPlaybackDanmakuMock.mockResolvedValue([{ text: "hello", time: 12, mode: 0 }]);

    const response = await route.GET(
      new Request(
        "http://localhost/api/play/danmaku?title=%E7%A5%9E%E5%A2%93%E5%B9%B4%E7%95%AA&play_episodes=11",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual([{ text: "hello", time: 12, mode: 0 }]);
    expect(getPlaybackDanmakuMock).toHaveBeenCalledWith({
      title: "神墓年番",
      play_episodes: "11",
    });
  });
});
