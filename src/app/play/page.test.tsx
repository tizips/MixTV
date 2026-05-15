import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayPageData } from "@/modules/playback/domain/playback-page-data";
import { PlayPageShell } from "@/modules/playback";
import PlayPage from "./page";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

describe("PlayPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("renders the playback layout sections", () => {
    const html = renderToStaticMarkup(<PlayPageShell />);

    expect(html).toContain("星河漫游");
    expect(html).toContain("选集");
    expect(html).toContain("换源");
    expect(html).toContain("收藏");
    expect(html).toContain("片源");
    expect(html).toContain("aria-label=\"播放进度\"");
    expect(html).toContain("title=\"下一集\"");
    expect(html).toContain("title=\"后退 10 秒\"");
    expect(html).toContain("title=\"前进 10 秒\"");
    expect(html).toContain("title=\"声音调节\"");
    expect(html).toContain("0:00 / 45:08");
    expect(html).toContain("title=\"弹幕设置\"");
    expect(html).toContain("title=\"网页全屏\"");
    expect(html).toContain("title=\"全屏\"");
  });

  it("renders a playback placeholder error when source or id is missing", async () => {
    const html = renderToStaticMarkup(await PlayPage({ searchParams: Promise.resolve({ source: "dyttzyapi.com" }) }));

    expect(html).toContain("缺少 source 或 id 参数，无法加载播放信息。");
    expect(html).not.toContain("aria-label=\"播放进度\"");
  });

  it("requires login before rendering playback", async () => {
    authMock.mockResolvedValue(null);

    const html = renderToStaticMarkup(await PlayPage({ searchParams: Promise.resolve({ id: "80474", source: "dyttzyapi.com" }) }));

    expect(html).toContain("请先登录后再播放。");
    expect(html).not.toContain("aria-label=\"播放进度\"");
  });

  it("starts the playback controls from the saved resume time when present", () => {
    const data: PlayPageData = {
      area: "电影天堂资源",
      category: "剧集",
      currentEpisode: 2,
      description: "播放详情简介",
      episodes: [{ duration: "未知", number: 2, title: "第2集" }],
      originalTitle: "剧集",
      posterUrl: "https://image.test/poster.jpg",
      progressId: "80474",
      progressSource: "dyttzyapi.com",
      rating: "暂无",
      resumeTimeSeconds: 125,
      sourceName: "电影天堂资源",
      sources: [
        {
          id: "episode-2",
          latency: "在线播放",
          name: "第2集",
          quality: "HLS",
          status: "流畅",
          url: "https://media.test/2.m3u8",
        },
      ],
      tags: ["更新至2集"],
      title: "资源站标题",
      year: "2026",
    };

    const html = renderToStaticMarkup(<PlayPageShell initialData={data} />);

    expect(html).toContain("2:05 / 45:08");
    expect(html).toContain("value=\"125\"");
  });
});
