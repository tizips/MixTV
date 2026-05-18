import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaybackDanmakuUrl,
  formatPlaybackDanmakuRequestTitle,
  parsePlaybackSeason,
} from "@/modules/playback/domain/playback-danmaku";
import { getPlaybackDanmaku } from "@/modules/playback/server/playback-danmaku-service";

const getDanmakuConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/admin", () => ({
  getDanmakuConfig: getDanmakuConfigMock,
}));

describe("playback danmaku service", () => {
  beforeEach(() => {
    getDanmakuConfigMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses season markers from titles", () => {
    expect(parsePlaybackSeason("某部剧 第三季")).toBe(3);
    expect(parsePlaybackSeason("Another Show Season 2")).toBe(2);
    expect(parsePlaybackSeason("Series S04")).toBe(4);
    expect(parsePlaybackSeason("Plain Title")).toBe(1);
  });

  it("builds a normalized danmaku keyword and request url", () => {
    expect(formatPlaybackDanmakuRequestTitle({ title: "神墓年番", playEpisodes: 11 })).toBe("神墓年番 S01E11");
    expect(formatPlaybackDanmakuRequestTitle({ title: " 神墓年番 第三季 ", playEpisodes: 7 })).toBe("神墓年番 S03E07");
    expect(createPlaybackDanmakuUrl({ title: " 神墓年番 第三季 ", playEpisodes: 11 })).toBe(
      "/api/play/danmaku?title=%E7%A5%9E%E5%A2%93%E5%B9%B4%E7%95%AA+S03E11&play_episodes=11",
    );
    expect(createPlaybackDanmakuUrl({ title: "   ", playEpisodes: 11 })).toBe("");
  });

  it("matches the season, resolves episode ids, and maps json comments to danmu items", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "smonetv",
      apiUrl: "https://smonedanmu.vercel.app",
      enabled: true,
      requestTimeoutSeconds: 30,
      updatedAt: "2026-05-18T00:00:00.000Z",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v2/match")) {
        return new Response(JSON.stringify({ isMatched: true, matches: [{ episodeId: "episode-123" }] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        });
      }

      if (url.includes("/api/v2/comment/episode-123")) {
        return new Response(
          JSON.stringify({
            comments: [
              { color: 16777215, mode: 1, text: "hello", time: 12.5 },
              { color: "#89D5FF", mode: 4, content: "world", progress: 30 },
            ],
          }),
          {
            headers: { "content-type": "application/json; charset=utf-8" },
            status: 200,
          },
        );
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const danmaku = await getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 });

    expect(danmaku).toEqual([
      { color: "#ffffff", mode: 1, text: "hello", time: 12.5 },
      { color: "#89D5FF", mode: 2, text: "world", time: 30 },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pathname: "/smonetv/api/v2/match",
      }),
      expect.objectContaining({
        body: JSON.stringify({ fileName: "神墓年番 S03E11" }),
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pathname: "/smonetv/api/v2/comment/episode-123",
        search: "?format=json&duration=true",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
        method: "GET",
      }),
    );
  });

  it("returns an empty list when danmaku is disabled", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "secret",
      apiUrl: "https://danmaku.test",
      enabled: false,
      requestTimeoutSeconds: 30,
      updatedAt: null,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
