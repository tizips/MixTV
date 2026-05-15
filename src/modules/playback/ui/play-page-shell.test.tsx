// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayPageShell } from "./play-page-shell";
import type { PlayPageData } from "../domain/playback-page-data";

type ArtplayerEventName = `video:${string}` | "destroy" | "error" | "fullscreenWeb";
type ArtplayerHandler = (...args: unknown[]) => void;

const artplayerState = vi.hoisted(() => ({
  instances: [] as FakeArtplayer[],
}));

class FakeArtplayer {
  currentTime = 0;
  duration = 2708;
  hls: unknown;
  muted = false;
  playbackRate = 1;
  playing = false;
  url: string;
  video = {
    readyState: 2,
    videoHeight: 720,
    videoWidth: 1280,
  } as HTMLVideoElement;
  volume = 0;
  plugins = {};
  private handlers = new Map<ArtplayerEventName, ArtplayerHandler[]>();

  constructor(options: { url: string }) {
    this.url = options.url;
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
  default: () => ({}),
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

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string | { src?: string } }) => (
    <span data-alt={alt} data-src={typeof src === "string" ? src : src?.src ?? ""} />
  ),
}));

vi.mock("@heroui/react", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    type,
  }: {
    children: ReactNode;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onPress}>
      {children}
    </button>
  ),
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Popover: Object.assign(
    ({ children }: { children: ReactNode }) => <>{children}</>,
    {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Heading: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
      Trigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    },
  ),
  Separator: () => <hr />,
  Switch: Object.assign(
    ({ isSelected, onValueChange }: { isSelected?: boolean; onValueChange?: (value: boolean) => void }) => (
      <input checked={Boolean(isSelected)} type="checkbox" onChange={(event) => onValueChange?.(event.currentTarget.checked)} />
    ),
    {
      Control: ({ children }: { children: ReactNode }) => <span>{children}</span>,
      Thumb: () => <span />,
    },
  ),
  Tabs: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      ListContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Tab: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    },
  ),
}));

afterEach(() => {
  document.body.innerHTML = "";
  artplayerState.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function createInitialData(): PlayPageData {
  return {
    area: "电影天堂资源",
    category: "剧集",
    currentEpisode: 1,
    description: "播放详情简介",
    episodes: [{ duration: "未知", number: 1, title: "第1集" }],
    originalTitle: "剧集",
    posterUrl: "https://image.test/poster.jpg",
    progressId: "80474",
    progressSource: "dyttzyapi.com",
    rating: "暂无",
    sourceName: "电影天堂资源",
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
  it("captures the initial zero-time frame when the video can play", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<PlayPageShell />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

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

    const art = artplayerState.instances[0];

    if (!art) {
      throw new Error("Artplayer was not initialized");
    }

    await act(async () => {
      art.emit("video:canplay", new Event("canplay"));
    });

    expect(host.innerHTML).toContain("data:image/jpeg;base64,zero-frame");

    act(() => {
      root.unmount();
    });
  });

  it("uploads playback progress when playback pauses", async () => {
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

    art.currentTime = 1061;
    art.duration = 1247;

    await act(async () => {
      art.emit("video:pause");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/playback/progress/dyttzyapi.com/80474", {
      body: JSON.stringify({ index: 1, play_time: 1061, total_time: 1247 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

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
      body: JSON.stringify({ index: 1, play_time: 25, total_time: 1247 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });
});
