import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayPageData } from "@/modules/playback/domain/playback-page-data";
import { PlayPageShell } from "@/modules/playback";
import PlayPage, { runtime } from "./page";

const authMock = vi.hoisted(() => vi.fn());
const getFavoriteItemMock = vi.hoisted(() => vi.fn());
const getPlaybackHistoryItemMock = vi.hoisted(() => vi.fn());
const getPlaybackPageDataMock = vi.hoisted(() => vi.fn());
const createPlaybackProgressStoreMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/favorites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/favorites")>();

  return {
    ...actual,
    getFavoriteItem: getFavoriteItemMock,
  };
});

vi.mock("@/modules/history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/history")>();

  return {
    ...actual,
    getPlaybackHistoryItem: getPlaybackHistoryItemMock,
  };
});

vi.mock("@/modules/playback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback")>();

  return {
    ...actual,
    getPlaybackPageData: getPlaybackPageDataMock,
  };
});

vi.mock("@/modules/playback/server/playback-progress-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-progress-service")>();

  return {
    ...actual,
    createPlaybackProgressStore: createPlaybackProgressStoreMock,
  };
});

function createInitialData(): PlayPageData {
    return {
      area: "电影天堂资源",
      category: "剧集",
      index: "2026:tv:资源站标题",
      play_episodes: 1,
      description: "播放详情简介",
      episodes: [{ duration: "未知", number: 1, title: "第1集" }],
      original_title: "剧集",
      cover_default: "https://image.test/poster.jpg",
      cover: "https://image.test/poster.jpg",
      progress_id: "80474",
      progress_source: "dyttzyapi.com",
      rating: "暂无",
      source_name: "电影天堂资源",
    sources: [
      {
        id: "episode-1",
        latency: "在线播放",
        name: "第1集",
        quality: "HLS",
        status: "流畅",
        url: "https://media.test/1.m3u8",
      },
    ],
    tags: ["更新至1集"],
    title: "资源站标题",
    year: "2026",
  };
}

describe("PlayPage", () => {
  const originalStorageType = process.env.STORAGE_TYPE;

  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getFavoriteItemMock.mockReset();
    getFavoriteItemMock.mockResolvedValue(null);
    getPlaybackHistoryItemMock.mockReset();
    getPlaybackHistoryItemMock.mockResolvedValue(null);
    getPlaybackPageDataMock.mockReset();
    getPlaybackPageDataMock.mockResolvedValue({
      status: "error",
      error: "缺少 source 或 id 参数，无法加载播放信息。",
    });
    createPlaybackProgressStoreMock.mockReset();
    createPlaybackProgressStoreMock.mockReturnValue({
      del: vi.fn(),
      get: vi.fn(),
      script: vi.fn(),
      set: vi.fn(),
    });
    process.env.STORAGE_TYPE = "upstash";
  });

  afterEach(() => {
    if (originalStorageType === undefined) {
      delete process.env.STORAGE_TYPE;
      return;
    }

    process.env.STORAGE_TYPE = originalStorageType;
  });

  it("renders the playback layout sections", () => {
    const html = renderToStaticMarkup(<PlayPageShell initialData={createInitialData()} />);

    expect(html).toContain("资源站标题");
    expect(html).toContain("选集");
    expect(html).toContain("换源");
    expect(html).toContain("收藏");
  });

  it("uses the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("renders a playback placeholder error when source or id is missing", async () => {
    const html = renderToStaticMarkup(await PlayPage({ searchParams: Promise.resolve({ source: "dyttzyapi.com" }) }));

    expect(html).toContain("缺少 source 或 id 参数，无法加载播放信息。");
    expect(html).not.toContain("aria-label=\"播放进度\"");
  });

  it("uses playback history index for source fallback when playback details fail", async () => {
    const progressStore = {
      del: vi.fn(),
      get: vi.fn(),
      script: vi.fn(),
      set: vi.fn(),
    };
    createPlaybackProgressStoreMock.mockReturnValue(progressStore);
    getPlaybackPageDataMock.mockResolvedValue({
      status: "error",
      error: "播放信息加载失败，请稍后重试。",
    });
    getPlaybackHistoryItemMock.mockResolvedValue({
      id: "79126",
      index: "2026:tv:历史标题",
      search_title: "",
      source: "iqiyizyapi.com",
      title: "历史标题",
    });
    getFavoriteItemMock.mockResolvedValue({
      id: "79126",
      index: "2026:tv:收藏标题",
      search_title: "",
      source: "iqiyizyapi.com",
      title: "收藏标题",
    });

    const html = renderToStaticMarkup(
      await PlayPage({
        searchParams: Promise.resolve({
          id: "79126",
          source: "iqiyizyapi.com",
        }),
      }),
    );

    expect(html).toContain("播放信息加载失败，请稍后重试。");
    expect(html).toContain("可用片源");
    expect(getPlaybackHistoryItemMock).toHaveBeenCalledWith(
      "user-1",
      { id: "79126", source: "iqiyizyapi.com" },
      { store: progressStore },
    );
    expect(getFavoriteItemMock).not.toHaveBeenCalled();
  });

  it("falls back to favorite index when playback history has no matching item", async () => {
    getPlaybackPageDataMock.mockResolvedValue({
      status: "error",
      error: "播放信息加载失败，请稍后重试。",
    });
    getPlaybackHistoryItemMock.mockResolvedValue(null);
    getFavoriteItemMock.mockResolvedValue({
      id: "79126",
      index: "2026:tv:收藏标题",
      search_title: "",
      source: "iqiyizyapi.com",
      title: "收藏标题",
    });

    const html = renderToStaticMarkup(
      await PlayPage({
        searchParams: Promise.resolve({
          id: "79126",
          source: "iqiyizyapi.com",
        }),
      }),
    );

    expect(html).toContain("播放信息加载失败，请稍后重试。");
    expect(html).toContain("可用片源");
    expect(getFavoriteItemMock).toHaveBeenCalledWith("user-1", {
      id: "79126",
      source: "iqiyizyapi.com",
    });
  });

  it("requires login before rendering playback", async () => {
    authMock.mockResolvedValue(null);

    const html = renderToStaticMarkup(await PlayPage({ searchParams: Promise.resolve({ id: "80474", source: "dyttzyapi.com" }) }));

    expect(html).toContain("请先登录后再播放。");
    expect(html).not.toContain("aria-label=\"播放进度\"");
  });

  it("renders the selected episode from initial data", () => {
    const data: PlayPageData = {
      area: "电影天堂资源",
      category: "剧集",
      index: "2026:tv:资源站标题",
      play_episodes: 2,
      description: "播放详情简介",
      episodes: [{ duration: "未知", number: 2, title: "第2集" }],
      original_title: "剧集",
      cover_default: "https://image.test/poster.jpg",
      cover: "https://image.test/poster.jpg",
      progress_id: "80474",
      progress_source: "dyttzyapi.com",
      rating: "暂无",
      play_time: 125,
      source_name: "电影天堂资源",
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

    expect(html).toContain("第 2 集");
    expect(html).toContain("资源站标题");
  });
});
