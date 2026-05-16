import { describe, expect, it, vi } from "vitest";
import {
  generateVideoSourceSearchVariants,
  getVideoSourceDetail,
  searchVideoSource,
  type VideoSourceEndpoint,
} from "@/integrations/video-sources";

const source: VideoSourceEndpoint = {
  apiUrl: "https://source.test/api.php/provide/vod",
  key: "demo",
  name: "Demo Source",
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

describe("video source adapter", () => {
  it("searches a standard video source and normalizes playable m3u8 results", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        list: [
          {
            vod_id: 123,
            vod_name: " Demo Title  ",
            vod_pic: " https://image.test/poster.jpg ",
            vod_play_url:
              "第1集$https://media.test/1.m3u8#第2集$https://media.test/2.m3u8$$$预告$https://media.test/trailer.mp4",
            vod_year: "2025-01-01",
            vod_content: "<p>Intro</p>",
            vod_class: "剧集",
            vod_remarks: "1080P",
            type_name: "国产剧",
          },
          {
            vod_id: 456,
            vod_name: "No playable URL",
            vod_play_url: "正片$https://media.test/video.mp4",
          },
        ],
        pagecount: 1,
      }),
    );

    const results = await searchVideoSource(source, "Demo", { fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      "https://source.test/api.php/provide/vod?ac=videolist&wd=Demo",
      expect.objectContaining({ headers: expect.any(Headers), signal: expect.any(AbortSignal) }),
    );
    expect(results).toEqual([
      {
        className: "剧集",
        description: "Intro",
        doubanId: undefined,
        episodeTitles: ["第1集", "第2集"],
        episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
        id: "123",
        posterUrl: "https://image.test/poster.jpg",
        remarks: "1080P",
        quality: "1080P",
        sourceKey: "demo",
        sourceName: "Demo Source",
        title: "Demo Title",
        typeName: "国产剧",
        year: "2025",
      },
    ]);
  });

  it("fetches additional search pages up to the configured limit", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          list: [
            {
              vod_id: "a",
              vod_name: "First",
              vod_play_url: "正片$https://media.test/a.m3u8",
            },
          ],
          pagecount: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          list: [
            {
              vod_id: "b",
              vod_name: "Second",
              vod_play_url: "正片$https://media.test/b.m3u8",
            },
          ],
        }),
      );

    const results = await searchVideoSource(source, "Demo", {
      fetcher,
      maxPages: 2,
      variants: ["Demo"],
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://source.test/api.php/provide/vod?ac=videolist&wd=Demo&pg=2",
      expect.anything(),
    );
    expect(results.map((result) => result.id)).toEqual(["a", "b"]);
  });

  it("fetches standard details and falls back to m3u8 links in content", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        list: [
          {
            vod_id: "detail-id",
            vod_name: "Detail Title",
            vod_pic: "",
            vod_content: 'fallback https://media.test/fallback.m3u8"',
            vod_year: "unknown",
          },
        ],
      }),
    );

    const detail = await getVideoSourceDetail(source, "detail-id", { fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      "https://source.test/api.php/provide/vod?ac=videolist&ids=detail-id",
      expect.anything(),
    );
    expect(detail).toMatchObject({
      episodes: ["https://media.test/fallback.m3u8"],
      id: "detail-id",
      sourceKey: "demo",
      title: "Detail Title",
    });
  });

  it("fetches optional html detail pages for sources that expose detailUrl", async () => {
    const fetcher = vi.fn(async () =>
      new Response(`
        <html>
          <body>
            <h1>HTML Detail Title</h1>
            <img src="https://image.test/html.jpg" />
            <div class="sketch"><p>HTML intro</p></div>
            <span>2024</span>
            $https://media.test/html-1.m3u8#1
            $https://media.test/html-2.m3u8#2
          </body>
        </html>
      `),
    );

    const detail = await getVideoSourceDetail(
      { ...source, detailUrl: "https://detail.test" },
      "99",
      { fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://detail.test/index.php/vod/detail/id/99.html",
      expect.anything(),
    );
    expect(detail).toMatchObject({
      description: "HTML intro",
      episodeTitles: ["1", "2"],
      episodes: ["https://media.test/html-1.m3u8", "https://media.test/html-2.m3u8"],
      id: "99",
      posterUrl: "https://image.test/html.jpg",
      title: "HTML Detail Title",
      year: "2024",
    });
  });

  it("generates focused search variants without duplicating ordinary queries", () => {
    expect(generateVideoSourceSearchVariants("Demo")).toEqual(["Demo"]);
    expect(generateVideoSourceSearchVariants("极速车魂第3季")).toEqual(["极速车魂第3季", "极速车魂第三季"]);
    expect(generateVideoSourceSearchVariants("咒术回战：怀玉")).toEqual(["咒术回战：怀玉", "咒术回战 怀玉"]);
    expect(generateVideoSourceSearchVariants("鬼灭 之刃")).toEqual(["鬼灭 之刃", "鬼灭之刃"]);
  });
});
