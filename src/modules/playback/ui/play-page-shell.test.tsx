// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import { PlayPageShell } from "./play-page-shell";
import type { PlayPageData } from "../domain/playback-page-data";

type ArtplayerEventName = `video:${string}` | "artplayerPluginDanmuku:config" | "destroy" | "error" | "fullscreenWeb";
type ArtplayerHandler = (...args: unknown[]) => void;

const artplayerState = vi.hoisted(() => ({
  instances: [] as FakeArtplayer[],
  controls: [] as Array<{ name?: string; position?: string; tooltip?: string; index?: number }>,
  danmakuLoads: [] as unknown[][],
  danmakuOptions: [] as Array<Record<string, unknown>>,
  settings: [] as Array<{ name?: string; html?: string }>,
}));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
}));

class FakeArtplayer {
  currentTime = 0;
  duration = 2708;
  hls: unknown;
  muted = false;
  playbackRate = 1;
  playing = false;
  poster = "";
  url: string;
  video = {
    readyState: 2,
    videoHeight: 720,
    videoWidth: 1280,
  } as HTMLVideoElement;
  volume = 0;
  plugins = {};
  controls = {
    add: (option: { name?: string; position?: string; tooltip?: string; index?: number }) => {
      artplayerState.controls.push(option);
      return document.createElement("div");
    },
  };
  setting = {
    add: (option: { name?: string; html?: string }) => {
      artplayerState.settings.push(option);
      return this;
    },
  };
  private handlers = new Map<ArtplayerEventName, ArtplayerHandler[]>();

  constructor(options: { url: string; poster?: string; plugins?: Array<{ name?: string }> }) {
    this.url = options.url;
    this.poster = options.poster ?? "";
    this.plugins = Object.fromEntries((options.plugins ?? []).map((plugin) => [plugin.name, plugin]));
    artplayerState.instances.push(this);
  }

  on(name: ArtplayerEventName, handler: ArtplayerHandler) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }

  emit(name: ArtplayerEventName, ...args: unknown[]) {
    for (const handler of this.handlers.get(name) ?? []) {
      handler(...args);
    }
  }

  destroy() {}

  pause() {
    this.playing = false;
  }

  async play() {
    this.playing = true;
  }

  async switchUrl(url: string) {
    this.url = url;
  }
}

vi.mock("artplayer", () => ({
  default: FakeArtplayer,
}));

vi.mock("artplayer-plugin-danmuku", () => ({
  default: (options: Record<string, unknown>) => {
    artplayerState.danmakuOptions.push(options);

    const plugin = {
      color: "#FFFFFF",
      emitter: false,
      fontSize: 20,
      load: vi.fn(async (danmuku?: unknown[]) => {
        artplayerState.danmakuLoads.push(danmuku ?? []);
        return plugin;
      }),
      margin: [10, "75%"],
      mode: 0,
      modes: [0, 1, 2],
      opacity: 0.85,
      speed: 7.5,
      name: "artplayerPluginDanmuku",
      antiOverlap: true,
      synchronousPlayback: true,
      visible: true,
    };

    return plugin;
  },
}));

vi.mock("hls.js", () => ({
  default: class FakeHls {
    static Events = { ERROR: "error" };
    static ErrorTypes = {
      MEDIA_ERROR: "mediaError",
      NETWORK_ERROR: "networkError",
    };

    static isSupported() {
      return false;
    }
  },
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string | { src?: string } }) => (
    <span data-alt={alt} data-src={typeof src === "string" ? src : src?.src ?? ""} />
  ),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ favorites: [] }))));
});

afterEach(() => {
  document.body.innerHTML = "";
  artplayerState.instances = [];
  artplayerState.controls = [];
  artplayerState.danmakuLoads = [];
  artplayerState.danmakuOptions = [];
  artplayerState.settings = [];
  toastState.error.mockReset();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
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

describe("PlayPageShell client playback cover", () => {
  it("uses the server favorite state and toggles the playback detail favorite button through the item API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/favorites/dyttzyapi.com/80474" && init?.method === "DELETE") {
        return new Response(JSON.stringify({ favorites: [] }));
      }

      if (url === "/api/favorites/dyttzyapi.com/80474" && init?.method === "POST") {
        return new Response(JSON.stringify({ favorite: {} }), { status: 201 });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.is_favorite = true;

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalledWith("/api/favorites", expect.anything());

    const unfavoriteButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("已收藏")) as HTMLButtonElement | undefined;

    if (!unfavoriteButton) {
      throw new Error("Loaded favorite button was not rendered");
    }

    await act(async () => {
      unfavoriteButton.click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/dyttzyapi.com/80474", {
      headers: { Accept: "application/json" },
      method: "DELETE",
    });

    const favoriteButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("收藏") && !button.textContent?.includes("已收藏")) as HTMLButtonElement | undefined;

    if (!favoriteButton) {
      throw new Error("Favorite button was not rendered after delete");
    }

    await act(async () => {
      favoriteButton.click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/dyttzyapi.com/80474", {
      headers: { Accept: "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });

  it("shows the current source name before the tags and omits the original title line", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const infoSection = host.querySelectorAll("section")[1] as HTMLElement | undefined;

    if (!infoSection) {
      throw new Error("Playback info section was not rendered");
    }

    const text = infoSection.textContent ?? "";

    expect(text).not.toContain("剧集");
    expect(text.indexOf("电影天堂资源")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("更新至1集")).toBeGreaterThan(text.indexOf("电影天堂资源"));

    act(() => {
      root.unmount();
    });
  });

  it("opens the episode group containing the current playback episode", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.play_episodes = 60;
    initialData.episodes = Array.from({ length: 60 }, (_, index) => ({
      duration: "未知",
      number: index + 1,
      title: `第${index + 1}集`,
    }));

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.querySelector('button[aria-label="第60集 未知"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("starts playback on the saved episode when progress has been restored", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.play_episodes = 2;
    initialData.sources = [
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
    ];
    initialData.episodes = [
      { duration: "未知", number: 1, title: "第1集" },
      { duration: "未知", number: 2, title: "第2集" },
    ];

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    expect(art.url).toBe("https://media.test/2.m3u8");
    expect(host.textContent).toContain("第 2 集");

    act(() => {
      root.unmount();
    });
  });

  it("registers Artplayer controls and leaves the built-in playback speed setting available", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(artplayerState.controls.map((control) => control.name)).toEqual([
      "mixtv-skip-backward",
      "mixtv-skip-forward",
      "mixtv-next-episode",
    ]);
    expect(artplayerState.controls.map((control) => control.position)).toEqual(["left", "left", "left"]);
    expect(artplayerState.controls.map((control) => control.index)).toEqual([11, 12, 13]);
    expect(artplayerState.settings).toEqual([]);

    act(() => {
      root.unmount();
    });
  });

  it("loads danmaku items from the playback danmaku API into the plugin", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `/api/play/danmaku?${new URLSearchParams({ title: "资源站标题 S01E01", play_episodes: "1" })}`) {
        return new Response(
          JSON.stringify([
            {
              text: "这女的戏份真多",
              time: 0,
              mode: 0,
            },
          ]),
        );
      }

      return new Response(JSON.stringify({ favorites: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/play/danmaku?${new URLSearchParams({ title: "资源站标题 S01E01", play_episodes: "1" })}`,
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(artplayerState.danmakuLoads).toEqual([
      [
        {
          text: "这女的戏份真多",
          time: 0,
          mode: 0,
        },
      ],
    ]);

    act(() => {
      root.unmount();
    });
  });

  it("restores the saved playback volume before rendering the player", async () => {
    localStorage.setItem("mixtv.playback.volume", "83");

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(artplayerState.instances[0]?.volume).toBeCloseTo(0.83, 2);

    act(() => {
      root.unmount();
    });
  });

  it("restores and persists saved playback danmaku settings", async () => {
    localStorage.setItem(
      "mixtv.playback.danmaku",
      JSON.stringify({
        antiOverlap: false,
        emitter: true,
        fontSize: 28,
        margin: [10, "50%"],
        mode: 2,
        modes: [0, 2],
        opacity: 0.66,
        speed: 8,
        synchronousPlayback: false,
        visible: false,
      }),
    );

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(artplayerState.danmakuOptions.at(-1)).toEqual(
      expect.objectContaining({
        antiOverlap: false,
        emitter: true,
        fontSize: 28,
        margin: [10, "50%"],
        mode: 2,
        modes: [0, 2],
        opacity: 0.66,
        speed: 8,
        synchronousPlayback: false,
        visible: false,
      }),
    );

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    art.volume = 0.61;
    art.emit("video:volumechange", new Event("volumechange"));

    expect(localStorage.getItem("mixtv.playback.volume")).toBe("61");

    art.emit("artplayerPluginDanmuku:config", {
      antiOverlap: true,
      emitter: false,
      fontSize: 24,
      margin: [10, 10],
      mode: 1,
      modes: [0, 1, 2],
      opacity: 0.7,
      speed: 7.5,
      synchronousPlayback: true,
      visible: true,
    });

    expect(localStorage.getItem("mixtv.playback.danmaku")).toBe(
      JSON.stringify({
        antiOverlap: true,
        color: "#FFFFFF",
        emitter: false,
        fontSize: 24,
        margin: [10, 10],
        mode: 1,
        modes: [0, 1, 2],
        opacity: 0.7,
        speed: 7.5,
        synchronousPlayback: true,
        visible: true,
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("renders a placeholder when playback data is missing", () => {
    const html = renderToStaticMarkup(<PlayPageShell />);

    expect(html).toContain("播放信息不可用");
    expect(html).not.toContain("星河漫游");
    expect(html).not.toContain("aria-label=\"播放进度\"");
  });

  it("shows playable source links when playback lookup fails but the index is available", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `/api/play/sources?index=${encodeURIComponent("2026:tv:资源站标题")}`) {
        return new Response(
          'event: start\ndata: {"total":1}\n\nevent: result\ndata: {"id":"80474","key":"alpha","name":"Alpha Source","quality":"1080P","source_name":"Alpha Source","total_episodes":2}\n\nevent: complete\ndata: {"completed":1,"total":1}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      return new Response(JSON.stringify({ favorites: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell playbackIndex="2026:tv:资源站标题" playbackPlaceholderError="查询失效，请重新选择片源。" />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/play/sources?index=${encodeURIComponent("2026:tv:资源站标题")}`,
      expect.objectContaining({ headers: { Accept: "text/event-stream" } }),
    );
    expect(host.querySelector('a[href*="source=alpha"][href*="id=80474"]')).not.toBeNull();
    expect(host.querySelector('a[href*="index="]')).toBeNull();
    expect(host.textContent).toContain("Alpha Source");
    expect(host.textContent).toContain("2 集");

    act(() => {
      root.unmount();
    });
  });

  it("uses a generated placeholder image when playback poster data is empty", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.cover = "";
    initialData.cover_default = "";

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const placeholderUrl = createPlaceholderImageUrl({
      variant: "poster",
      fileStem: "资源站标题",
      seed: "dyttzyapi.com-80474",
    });

    expect(host.innerHTML).toContain(placeholderUrl);

    act(() => {
      root.unmount();
    });
  });

  it("captures the initial frame before playback starts and clears it when playback begins", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          height: 0,
          toDataURL: () => "data:image/jpeg;base64,zero-frame",
          width: 0,
        } as unknown as HTMLCanvasElement;
      }

      return originalCreateElement(tagName);
    });

    await act(async () => {
      art.emit("video:canplay", new Event("canplay"));
    });

    expect(art.poster).toBe("data:image/jpeg;base64,zero-frame");

    await act(async () => {
      art.emit("video:play", new Event("play"));
    });

    expect(art.poster).toBe("");

    act(() => {
      root.unmount();
    });
  });

  it("uploads playback progress when playback pauses without restoring the captured cover", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ progress: {} })));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    await act(async () => {
      art.emit("video:canplay", new Event("canplay"));
    });
    await act(async () => {
      art.emit("video:play", new Event("play"));
    });

    art.currentTime = 1061;
    art.duration = 1247;

    await act(async () => {
      art.emit("video:pause");
    });

    expect(art.poster).toBe("");
    expect(fetchMock).toHaveBeenCalledWith("/api/playback/progress/dyttzyapi.com/80474", {
      body: JSON.stringify({ play_episodes: 1, play_time: 1061, total_time: 1247 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });

  it("restarts temporary cover capture when switching episodes", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.play_episodes = 2;
    initialData.sources = [
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
    ];
    initialData.episodes = [
      { duration: "未知", number: 1, title: "第1集" },
      { duration: "未知", number: 2, title: "第2集" },
    ];

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          height: 0,
          toDataURL: () => "data:image/jpeg;base64,next-frame",
          width: 0,
        } as unknown as HTMLCanvasElement;
      }

      return originalCreateElement(tagName);
    });

    await act(async () => {
      art.emit("video:canplay", new Event("canplay"));
    });
    await act(async () => {
      art.emit("video:play", new Event("play"));
    });

    expect(art.poster).toBe("");

    const episodeButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "1") as HTMLButtonElement | undefined;

    if (!episodeButton) {
      throw new Error("Episode button was not rendered");
    }

    await act(async () => {
      episodeButton.click();
    });

    expect(art.poster).toBe("https://image.test/poster.jpg");

    await act(async () => {
      art.emit("video:canplay", new Event("canplay"));
    });

    expect(art.poster).toBe("data:image/jpeg;base64,next-frame");

    act(() => {
      root.unmount();
    });
  });

  it("uploads playback progress periodically while playing", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ progress: {} })));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    art.currentTime = 25;
    art.duration = 1247;

    await act(async () => {
      art.emit("video:play");
    });
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/playback/progress/dyttzyapi.com/80474", {
      body: JSON.stringify({ play_episodes: 1, play_time: 25, total_time: 1247 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });

  it("switches to the selected episode source and keeps playing when an episode is changed during playback", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const initialData = createInitialData();
    initialData.sources = [
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
    ];
    initialData.episodes = [
      { duration: "未知", number: 1, title: "第1集" },
      { duration: "未知", number: 2, title: "第2集" },
    ];

    await act(async () => {
      root.render(<PlayPageShell initialData={initialData} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    await act(async () => {
      art.emit("video:play");
    });

    const nextEpisodeButton = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "2",
    ) as HTMLButtonElement | undefined;

    if (!nextEpisodeButton) {
      throw new Error("Episode button was not rendered");
    }

    await act(async () => {
      nextEpisodeButton.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const currentArt = artplayerState.instances.at(-1);

    if (!currentArt) {
      throw new Error("Artplayer was not reinitialized");
    }

    expect(host.textContent).toContain("第 2 集");
    expect(currentArt.url).toBe("https://media.test/2.m3u8");
    expect(currentArt.playing).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("switches playback sources in place and updates the route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `/api/play/sources?index=${encodeURIComponent("2026:tv:资源站标题")}`) {
        return new Response(
          'event: start\ndata: {"total":1}\n\nevent: result\ndata: {"id":"80474","key":"alpha","name":"Alpha Source","quality":"1080P","source_name":"Alpha Source","total_episodes":2}\n\nevent: complete\ndata: {"completed":1,"total":1}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      if (url === "/api/play/sources" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
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
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ favorites: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const sourceButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Alpha Source")) as HTMLButtonElement | undefined;

    if (!sourceButton) {
      throw new Error("Playback source button was not rendered");
    }

    await act(async () => {
      sourceButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const switchCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return url === "/api/play/sources" && init?.method === "POST";
    });

    if (!switchCall) {
      throw new Error("Playback source switch request was not sent");
    }

    const [, switchInit] = switchCall;
    const switchBody = JSON.parse(String(switchInit?.body)) as Record<string, unknown>;

    expect(switchBody).toMatchObject({
      currentId: "80474",
      currentSource: "dyttzyapi.com",
    });
    expect(window.location.search).toContain("source=alpha");
    expect(window.location.search).toContain("id=80474");

    const infoSection = host.querySelectorAll("section")[1] as HTMLElement | undefined;

    if (!infoSection) {
      throw new Error("Playback info section was not rendered after source switch");
    }

    expect(infoSection.textContent ?? "").toContain("Alpha Source");

    act(() => {
      root.unmount();
    });
  });

  it("shows source switch failures through message without rendering page error text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `/api/play/sources?index=${encodeURIComponent("2026:tv:资源站标题")}`) {
        return new Response(
          'event: start\ndata: {"total":1}\n\nevent: result\ndata: {"id":"80474","key":"alpha","name":"Alpha Source","quality":"1080P","source_name":"Alpha Source","total_episodes":2}\n\nevent: complete\ndata: {"completed":1,"total":1}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      if (url === "/api/play/sources" && init?.method === "POST") {
        return new Response(JSON.stringify({ message: "换源失败，请稍后重试。" }), {
          headers: { "Content-Type": "application/json" },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ favorites: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell initialData={createInitialData()} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const sourcesTab = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("换源")) as HTMLButtonElement | undefined;

    if (!sourcesTab) {
      throw new Error("Playback sources tab was not rendered");
    }

    await act(async () => {
      sourcesTab.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const sourceButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Alpha Source")) as HTMLButtonElement | undefined;

    if (!sourceButton) {
      throw new Error("Playback source button was not rendered");
    }

    await act(async () => {
      sourceButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastState.error).toHaveBeenCalledWith("换源失败，请稍后重试。");
    expect(host.textContent ?? "").not.toContain("换源失败，请稍后重试。");

    act(() => {
      root.unmount();
    });
  });
});
