import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaybackDanmakuUrl,
  formatPlaybackDanmakuRequestTitle,
  parsePlaybackSeason,
} from "@/modules/playback/domain/playback-danmaku";
import { getPlaybackDanmaku, getPlaybackDanmakuSegment } from "@/modules/playback/server/playback-danmaku-service";

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

  afterEach(() => {
    vi.useRealTimers();
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
      loadMode: "full",
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

    const result = await getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 });

    expect(result).toEqual({
      loadMode: "full",
      items: [
        { color: "#ffffff", mode: 1, text: "hello", time: 12.5 },
        { color: "#89D5FF", mode: 2, text: "world", time: 30 },
      ],
      segments: [],
      episodeId: "episode-123",
    });
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
        signal: expect.any(AbortSignal),
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
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("aborts the upstream request after the configured timeout and records the error", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "smonetv",
      apiUrl: "https://smonedanmu.vercel.app",
      enabled: true,
      requestTimeoutSeconds: 30,
      loadMode: "full",
      updatedAt: null,
    });

    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("This operation was aborted"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const danmakuPromise = getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 });

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(danmakuPromise).resolves.toEqual({
      loadMode: "full",
      items: [],
      segments: [],
      episodeId: "",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load playback danmaku.", expect.any(Error));
  }, 15_000);

  it("returns an empty list when danmaku is disabled", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "secret",
      apiUrl: "https://danmaku.test",
      enabled: false,
      requestTimeoutSeconds: 30,
      loadMode: "full",
      updatedAt: null,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 })).resolves.toEqual({
      loadMode: "full",
      items: [],
      segments: [],
      episodeId: "",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the segment list when loadMode is segment", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "smonetv",
      apiUrl: "https://smonedanmu.vercel.app",
      enabled: true,
      requestTimeoutSeconds: 30,
      loadMode: "segment",
      updatedAt: null,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v2/match")) {
        return new Response(JSON.stringify({ isMatched: true, matches: [{ episodeId: "episode-456" }] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        });
      }

      if (url.includes("/api/v2/comment/episode-456")) {
        return new Response(
          JSON.stringify({
            comments: {
              type: "youku",
              duration: 0,
              segmentList: [
                {
                  type: "youku",
                  segment_start: 0,
                  segment_end: 60,
                  url: "https://youku.test/seg/0",
                  data: "{\"mat\":0}",
                  _m_h5_tk: "token-0",
                  _m_h5_tk_enc: "enc-0",
                },
                { type: "youku", segment_start: 60, segment_end: 120, url: "https://youku.test/seg/1" },
              ],
            },
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

    const result = await getPlaybackDanmaku({ title: "神墓年番 第三季", play_episodes: 11 });

    expect(result).toEqual({
      loadMode: "segment",
      items: [],
      episodeId: "episode-456",
      segments: [
        {
          start: 0,
          end: 60,
          url: "https://youku.test/seg/0",
          type: "youku",
          data: "{\"mat\":0}",
          mH5Tk: "token-0",
          mH5TkEnc: "enc-0",
        },
        { start: 60, end: 120, url: "https://youku.test/seg/1", type: "youku" },
      ],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pathname: "/smonetv/api/v2/comment/episode-456",
        search: "?format=json&segmentflag=true",
      }),
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("proxies a single segment via getPlaybackDanmakuSegment", async () => {
    getDanmakuConfigMock.mockResolvedValue({
      apiToken: "smonetv",
      apiUrl: "https://smonedanmu.vercel.app",
      enabled: true,
      requestTimeoutSeconds: 30,
      loadMode: "segment",
      updatedAt: null,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/v2/segmentcomment")) {
        const body = JSON.parse(String(init?.body ?? "{}"));

        // 上游 Segment.fromJson 要求完整 segment 对象。
        expect(body).toEqual({
          segment_start: 0,
          segment_end: 60,
          url: "https://youku.test/seg/0",
          type: "youku",
          data: "{\"mat\":0}",
          _m_h5_tk: "token-0",
          _m_h5_tk_enc: "enc-0",
        });

        return new Response(
          JSON.stringify({
            comments: [{ m: "nice", t: 5, p: "5,1,16777215,[youku]" }],
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

    const items = await getPlaybackDanmakuSegment({
      segment: {
        start: 0,
        end: 60,
        url: "https://youku.test/seg/0",
        type: "youku",
        data: "{\"mat\":0}",
        mH5Tk: "token-0",
        mH5TkEnc: "enc-0",
      },
    });

    expect(items).toEqual([{ text: "nice", time: 5, mode: 0 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/smonetv/api/v2/segmentcomment", search: "?format=json" }),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          segment_start: 0,
          segment_end: 60,
          url: "https://youku.test/seg/0",
          type: "youku",
          data: "{\"mat\":0}",
          _m_h5_tk: "token-0",
          _m_h5_tk_enc: "enc-0",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
