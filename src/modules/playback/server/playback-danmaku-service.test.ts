import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin", () => ({
  getDanmakuConfig: vi.fn(async () => ({
    apiToken: "token",
    apiUrl: "https://danmaku.example.com",
    enabled: true,
    requestTimeoutSeconds: 30,
    loadMode: "full",
    updatedAt: null,
  })),
}));

import { getPlaybackDanmaku } from "./playback-danmaku-service";

describe("playback danmaku service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not print third-party request details", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            isMatched: true,
            matches: [{ episodeId: "episode-1" }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              text: "这女的戏份真多",
              time: 0,
              mode: 0,
            },
          ]),
        ),
      );

    const danmaku = await getPlaybackDanmaku({
      play_episodes: "1",
      title: "资源站标题",
    }, { fetcher: fetcher as typeof fetch });

    expect(danmaku).toEqual({
      loadMode: "full",
      items: [
        {
          text: "这女的戏份真多",
          time: 0,
          mode: 0,
        },
      ],
      segments: [],
      episodeId: "episode-1",
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
