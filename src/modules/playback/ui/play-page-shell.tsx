"use client";

import {
  ApiOutlined,
  ClockCircleOutlined,
  FastBackwardFilled,
  FastForwardFilled,
  ForwardOutlined,
  GlobalOutlined,
  HeartFilled,
  HeartOutlined,
  NumberOutlined,
  PlaySquareFilled,
  RightOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Hls from "hls.js";
import type Artplayer from "artplayer";
import type { Setting, SettingOption } from "artplayer";
import type {
  Danmu,
  Option as DanmakuOption,
  Result as DanmakuPluginResult,
} from "artplayer-plugin-danmuku";
import Image from "next/image";
import { App, Button, Divider, Tag } from "antd";
import { env } from "@/shared/env";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { Episode, PlayPageData } from "../domain/playback-page-data";
import {
  createPlaybackDanmakuUrl,
  playbackDanmakuSegmentEndpoint,
} from "../domain/playback-danmaku";

const episodeGroupSize = 50;
const playbackDurationSeconds = 45 * 60 + 8;
const defaultPlaybackVolume: number = 50;
const playbackVolumeStorageKey = "mixtv.playback.volume";
const playbackDanmakuStorageKey = "mixtv.playback.danmaku";
const strongBufferingStorageKey = "mixtv.playback.strong-buffering";
const playbackRateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type PlaybackDanmakuPreferences = {
  antiOverlap: boolean;
  color: string;
  emitter: boolean;
  fontSize: number;
  margin: NonNullable<DanmakuOption["margin"]>;
  mode: NonNullable<DanmakuOption["mode"]>;
  modes: NonNullable<DanmakuOption["modes"]>;
  opacity: number;
  speed: number;
  synchronousPlayback: boolean;
  visible: boolean;
};

const defaultPlaybackDanmakuSettings: PlaybackDanmakuPreferences = {
  antiOverlap: true,
  color: "#FFFFFF",
  emitter: false,
  fontSize: 20,
  margin: [10, "75%"],
  mode: 0,
  modes: [0, 1, 2],
  opacity: 0.85,
  speed: 7.5,
  synchronousPlayback: true,
  visible: true,
};
type HlsBufferConfig = ConstructorParameters<typeof Hls>[0];
const tabGlowClassNames = [
  "before:bg-[radial-gradient(circle_at_42%_42%,color-mix(in_srgb,var(--accent)_13%,transparent)_0%,transparent_36%),radial-gradient(circle_at_62%_58%,color-mix(in_srgb,var(--accent)_9%,transparent)_0%,transparent_34%),radial-gradient(ellipse_64%_42%_at_52%_50%,color-mix(in_srgb,var(--accent)_6%,transparent)_0%,transparent_72%)]",
  "before:bg-[radial-gradient(circle_at_36%_56%,color-mix(in_srgb,var(--accent)_12%,transparent)_0%,transparent_32%),radial-gradient(circle_at_58%_38%,color-mix(in_srgb,var(--accent)_9%,transparent)_0%,transparent_38%),radial-gradient(ellipse_70%_46%_at_50%_52%,color-mix(in_srgb,var(--accent)_5%,transparent)_0%,transparent_74%)]",
  "before:bg-[radial-gradient(circle_at_46%_34%,color-mix(in_srgb,var(--accent)_11%,transparent)_0%,transparent_34%),radial-gradient(circle_at_66%_54%,color-mix(in_srgb,var(--accent)_8%,transparent)_0%,transparent_36%),radial-gradient(ellipse_58%_52%_at_48%_54%,color-mix(in_srgb,var(--accent)_6%,transparent)_0%,transparent_76%)]",
  "before:bg-[radial-gradient(circle_at_34%_44%,color-mix(in_srgb,var(--accent)_10%,transparent)_0%,transparent_30%),radial-gradient(circle_at_54%_64%,color-mix(in_srgb,var(--accent)_11%,transparent)_0%,transparent_35%),radial-gradient(ellipse_68%_40%_at_55%_48%,color-mix(in_srgb,var(--accent)_5%,transparent)_0%,transparent_72%)]",
] as const;

type TabGlowClassName = (typeof tabGlowClassNames)[number];
type ArtplayerWithHls = Artplayer & { hls?: Hls };
type PlaybackSourceOption = {
  id: string;
  key: string;
  name: string;
  ping?: number;
  probe_url?: string;
  quality?: string;
  source_name: string;
  total_episodes: number;
};
type PlaybackSourceSseResult = Omit<PlaybackSourceOption, "ping"> & {
  ping?: unknown;
};
type PlaybackSourceSseEvent =
  | { event: "start"; data: { total: number } }
  | { event: "result"; data: PlaybackSourceSseResult }
  | { event: "complete"; data: { completed: number; total: number } }
  | { event: "error"; data: { message?: string } };
type PlaybackDanmakuResponseItem = {
  color?: unknown;
  emitter?: unknown;
  antiOverlap?: unknown;
  fontSize?: unknown;
  mode?: unknown;
  modes?: unknown;
  opacity?: unknown;
  speed?: unknown;
  synchronousPlayback?: unknown;
  text?: unknown;
  time?: unknown;
  visible?: unknown;
};

function getArtplayerDanmakuPlugin(
  art: Artplayer,
): DanmakuPluginResult | undefined {
  return art.plugins.artplayerPluginDanmuku as DanmakuPluginResult | undefined;
}

function getEpisodeGroups(episodes: Episode[]) {
  return Array.from(
    { length: Math.ceil(episodes.length / episodeGroupSize) },
    (_, index) => {
      const start = index * episodeGroupSize;
      const groupEpisodes = episodes.slice(start, start + episodeGroupSize);

      return {
        key: `${groupEpisodes[0]?.number ?? start}-${groupEpisodes.at(-1)?.number ?? start}`,
        label: `${groupEpisodes[0]?.number ?? start}-${groupEpisodes.at(-1)?.number ?? start}`,
        episodes: groupEpisodes,
      };
    },
  );
}

function getEpisodeGroupKeyForEpisode(
  episodes: Episode[],
  episodeNumber: number,
) {
  const group = getEpisodeGroups(episodes).find((currentGroup) =>
    currentGroup.episodes.some((episode) => episode.number === episodeNumber),
  );

  return group?.key ?? getEpisodeGroups(episodes)[0]?.key ?? "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeResumeTime(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function createPlayUrl(input: { id: string; source: string }) {
  const searchParams = new URLSearchParams({
    id: input.id.trim(),
    source: input.source.trim(),
  });

  return `/play?${searchParams.toString()}`;
}

function createPlaybackSourcesUrl(input: { index: string; keyword: string }) {
  const searchParams = new URLSearchParams({
    index: input.index.trim(),
    keyword: input.keyword.trim(),
  });

  return `/api/play/sources?${searchParams.toString()}`;
}

function formatPlaybackSourcePing(ping: unknown) {
  const value = typeof ping === "number" ? ping : Number(ping);

  if (!Number.isFinite(value) || value < 0) {
    return "未知";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  const seconds = value / 1000;
  const formatted = seconds < 10
    ? seconds.toFixed(1).replace(/\.0$/, "")
    : String(Math.round(seconds));

  return `${formatted} s`;
}

function getPlaybackSourcePingTagColor(ping: unknown) {
  const value = typeof ping === "number" ? ping : Number(ping);

  if (!Number.isFinite(value) || value < 0) {
    return "default";
  }

  if (value < 800) {
    return "success";
  }

  if (value < 2000) {
    return "warning";
  }

  return "error";
}

function readClientPlaybackSourcePing(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function createPlaybackSourceProbeUrl(source: PlaybackSourceOption) {
  const rawProbeUrl = source.probe_url?.trim();

  if (!rawProbeUrl) {
    return null;
  }

  try {
    const url = new URL(
      rawProbeUrl,
      typeof window === "undefined" ? undefined : window.location.href,
    );
    url.searchParams.set("_mixtv_probe", String(Date.now()));
    return url.toString();
  } catch {
    return null;
  }
}

async function measurePlaybackSourcePing(
  source: PlaybackSourceOption,
  signal: AbortSignal,
) {
  const probeUrl = createPlaybackSourceProbeUrl(source);

  if (!probeUrl || signal.aborted) {
    return undefined;
  }

  const startedAt = performance.now();

  try {
    await fetch(probeUrl, {
      cache: "no-store",
      mode: "no-cors",
      signal,
    });
  } catch {
    return undefined;
  }

  if (signal.aborted) {
    return undefined;
  }

  return readClientPlaybackSourcePing(startedAt);
}

function upsertPlaybackSourceOption(
  source: PlaybackSourceOption,
  seen: Map<string, PlaybackSourceOption>,
  setOptions: (sources: PlaybackSourceOption[]) => void,
  signal: AbortSignal,
) {
  const key = `${source.key}:${source.id}`;
  seen.set(key, source);
  setOptions(Array.from(seen.values()));

  void measurePlaybackSourcePing(source, signal).then((ping) => {
    if (signal.aborted || ping === undefined) {
      return;
    }

    const current = seen.get(key);

    if (!current) {
      return;
    }

    seen.set(key, { ...current, ping });
    setOptions(Array.from(seen.values()));
  });
}

function readStoredPlaybackVolume(): number {
  if (typeof window === "undefined") {
    return defaultPlaybackVolume;
  }

  const storedValue = window.localStorage.getItem(playbackVolumeStorageKey);

  if (!storedValue) {
    return defaultPlaybackVolume;
  }

  const parsedValue = Number(storedValue);

  return Number.isFinite(parsedValue)
    ? clamp(Math.round(parsedValue), 0, 100)
    : defaultPlaybackVolume;
}

function readStoredStrongBuffering(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(strongBufferingStorageKey) === "true";
}

function storeStrongBuffering(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.localStorage.setItem(strongBufferingStorageKey, "true");
    return;
  }

  window.localStorage.removeItem(strongBufferingStorageKey);
}

function createHlsBufferConfig(strongBuffering: boolean): HlsBufferConfig {
  return strongBuffering
    ? {
        backBufferLength: 300,
        enableWorker: true,
        fragLoadingTimeOut: 30000,
        lowLatencyMode: false,
        manifestLoadingTimeOut: 30000,
        maxBufferLength: 240,
        maxBufferSize: 120 * 1000 * 1000,
        maxMaxBufferLength: 600,
      }
    : {
        backBufferLength: 90,
        enableWorker: true,
        fragLoadingTimeOut: 20000,
        lowLatencyMode: false,
        manifestLoadingTimeOut: 15000,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      };
}

function formatPlaybackRateLabel(value: number) {
  return value === 1 ? "正常" : value.toFixed(2).replace(/\.?0+$/, "");
}

function readStoredPlaybackDanmakuSettings(): PlaybackDanmakuPreferences {
  if (typeof window === "undefined") {
    return { ...defaultPlaybackDanmakuSettings };
  }

  const storedValue = window.localStorage.getItem(playbackDanmakuStorageKey);

  if (!storedValue) {
    return { ...defaultPlaybackDanmakuSettings };
  }

  try {
    return normalizePlaybackDanmakuPreferences(JSON.parse(storedValue));
  } catch {
    return { ...defaultPlaybackDanmakuSettings };
  }
}

function storePlaybackDanmakuSettings(settings: PlaybackDanmakuPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    playbackDanmakuStorageKey,
    JSON.stringify(settings),
  );
}

function normalizePlaybackDanmakuMargin(
  value: unknown,
): NonNullable<DanmakuOption["margin"]> | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }

  const [top, bottom] = value;

  if (typeof top !== "number" || !Number.isFinite(top)) {
    return undefined;
  }

  if (typeof bottom === "number" && Number.isFinite(bottom)) {
    return [clamp(Math.round(top), 0, 100), clamp(Math.round(bottom), 0, 100)];
  }

  if (typeof bottom === "string" && /^-?\d+(\.\d+)?%$/.test(bottom.trim())) {
    return [clamp(Math.round(top), 0, 100), bottom.trim() as `${number}%`];
  }

  return undefined;
}

function normalizePlaybackDanmakuModes(
  value: unknown,
): NonNullable<DanmakuOption["modes"]> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const nextModes = value
    .map((item) => normalizePlaybackDanmakuMode(item))
    .filter((item): item is 0 | 1 | 2 => item !== undefined);

  if (!nextModes.length) {
    return undefined;
  }

  return Array.from(new Set(nextModes));
}

function normalizePlaybackDanmakuPreferences(
  value: unknown,
): PlaybackDanmakuPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultPlaybackDanmakuSettings };
  }

  const record = value as Record<string, unknown>;

  return {
    antiOverlap:
      typeof record.antiOverlap === "boolean"
        ? record.antiOverlap
        : defaultPlaybackDanmakuSettings.antiOverlap,
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color.trim()
        : defaultPlaybackDanmakuSettings.color,
    emitter:
      typeof record.emitter === "boolean"
        ? record.emitter
        : defaultPlaybackDanmakuSettings.emitter,
    fontSize:
      typeof record.fontSize === "number" && Number.isFinite(record.fontSize)
        ? record.fontSize
        : defaultPlaybackDanmakuSettings.fontSize,
    margin:
      normalizePlaybackDanmakuMargin(record.margin) ??
      defaultPlaybackDanmakuSettings.margin,
    mode:
      normalizePlaybackDanmakuMode(record.mode) ??
      defaultPlaybackDanmakuSettings.mode,
    modes:
      normalizePlaybackDanmakuModes(record.modes) ??
      defaultPlaybackDanmakuSettings.modes,
    opacity:
      typeof record.opacity === "number" && Number.isFinite(record.opacity)
        ? clamp(record.opacity, 0, 1)
        : defaultPlaybackDanmakuSettings.opacity,
    speed:
      typeof record.speed === "number" && Number.isFinite(record.speed)
        ? clamp(record.speed, 1, 10)
        : defaultPlaybackDanmakuSettings.speed,
    synchronousPlayback:
      typeof record.synchronousPlayback === "boolean"
        ? record.synchronousPlayback
        : defaultPlaybackDanmakuSettings.synchronousPlayback,
    visible:
      typeof record.visible === "boolean"
        ? record.visible
        : defaultPlaybackDanmakuSettings.visible,
  };
}

function normalizePlaybackDanmakuMode(value: unknown): 0 | 1 | 2 | undefined {
  if (
    value === 0 ||
    value === "0" ||
    value === "scroll" ||
    value === "Scroll"
  ) {
    return 0;
  }

  if (value === 1 || value === "1" || value === "top" || value === "Top") {
    return 1;
  }

  if (
    value === 2 ||
    value === "2" ||
    value === "bottom" ||
    value === "Bottom"
  ) {
    return 2;
  }

  return undefined;
}

function normalizePlaybackDanmakuColor(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${Math.max(0, Math.min(0xffffff, Math.floor(value)))
      .toString(16)
      .padStart(6, "0")}`;
  }

  return undefined;
}

function readPlaybackDanmakuItems(payload: unknown): Danmu[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const result: Danmu[] = [];

  for (const item of payload) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const danmakuItem = item as PlaybackDanmakuResponseItem;
    const text =
      typeof danmakuItem.text === "string" ? danmakuItem.text.trim() : "";

    if (!text) {
      continue;
    }

    const time =
      typeof danmakuItem.time === "number"
        ? danmakuItem.time
        : Number(danmakuItem.time);

    if (!Number.isFinite(time) || time < 0) {
      continue;
    }

    const danmu: Danmu = {
      text,
      time,
    };

    const mode = normalizePlaybackDanmakuMode(danmakuItem.mode);

    if (mode !== undefined) {
      danmu.mode = mode;
    }

    const color = normalizePlaybackDanmakuColor(danmakuItem.color);

    if (color) {
      danmu.color = color;
    }

    result.push(danmu);
  }

  return result;
}

type PlaybackDanmakuSegment = {
  start: number;
  end: number;
  url: string;
  type: string;
  data?: string;
  mH5Tk?: string;
  mH5TkEnc?: string;
};

type PlaybackDanmakuResult = {
  loadMode: "full" | "segment";
  items: Danmu[];
  segments: PlaybackDanmakuSegment[];
};

function readPlaybackDanmakuSegments(value: unknown): PlaybackDanmakuSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: PlaybackDanmakuSegment[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const segment = entry as Record<string, unknown>;
    const url = typeof segment.url === "string" ? segment.url.trim() : "";

    if (!url) {
      continue;
    }

    const type = typeof segment.type === "string" ? segment.type.trim() : "";

    if (!type) {
      continue;
    }

    const start = typeof segment.start === "number" ? segment.start : Number(segment.start);
    const end = typeof segment.end === "number" ? segment.end : Number(segment.end);

    const parsed: PlaybackDanmakuSegment = {
      start: Number.isFinite(start) && start >= 0 ? start : 0,
      end: Number.isFinite(end) && end >= 0 ? end : 0,
      url,
      type,
    };

    if (typeof segment.data === "string") {
      parsed.data = segment.data;
    }

    if (typeof segment.mH5Tk === "string") {
      parsed.mH5Tk = segment.mH5Tk;
    }

    if (typeof segment.mH5TkEnc === "string") {
      parsed.mH5TkEnc = segment.mH5TkEnc;
    }

    result.push(parsed);
  }

  return result;
}

function readPlaybackDanmakuResult(payload: unknown): PlaybackDanmakuResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { loadMode: "full", items: readPlaybackDanmakuItems(payload), segments: [] };
  }

  const record = payload as Record<string, unknown>;
  const loadMode = record.loadMode === "segment" ? "segment" : "full";

  return {
    loadMode,
    items: readPlaybackDanmakuItems(record.items),
    segments: loadMode === "segment" ? readPlaybackDanmakuSegments(record.segments) : [],
  };
}

type PlaybackSourceSwitchResponse = {
  episodes: Episode[];
  progress: {
    id: string;
    play_episodes: number;
    play_time: number;
    source: string;
    total_time: number;
  };
  source_name: string;
  sources: Array<{
    id: string;
    latency: string;
    name: string;
    quality: string;
    status: "流畅" | "拥挤" | "维护";
    url: string;
  }>;
};

function parsePlaybackSourceSseBlock(
  block: string,
): PlaybackSourceSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  try {
    const data = JSON.parse(dataLines.join("\n")) as unknown;

    if (
      event === "start" ||
      event === "result" ||
      event === "complete" ||
      event === "error"
    ) {
      return { event, data } as PlaybackSourceSseEvent;
    }
  } catch {
    return null;
  }

  return null;
}

function readPlaybackSourceSseEvents(buffer: string) {
  const events: PlaybackSourceSseEvent[] = [];
  let remaining = buffer;
  let separatorIndex = remaining.indexOf("\n\n");

  while (separatorIndex >= 0) {
    const block = remaining.slice(0, separatorIndex).trimEnd();
    remaining = remaining.slice(separatorIndex + 2);
    const event = parsePlaybackSourceSseBlock(block);

    if (event) {
      events.push(event);
    }

    separatorIndex = remaining.indexOf("\n\n");
  }

  return { events, remaining };
}

async function readPlaybackSourceOptions(
  response: Response,
  onResult: (source: PlaybackSourceOption) => void,
  signal?: AbortSignal,
) {
  if (!response.ok || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      return;
    }

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = readPlaybackSourceSseEvents(buffer);
    buffer = parsed.remaining;

    for (const event of parsed.events) {
      if (event.event === "result") {
        onResult({
          id: event.data.id,
          key: event.data.key,
          name: event.data.name,
          probe_url: event.data.probe_url,
          quality: event.data.quality,
          source_name: event.data.source_name,
          total_episodes: event.data.total_episodes,
        });
      }
    }
  }
}

export function PlayPageShell({
  initialData,
  playbackKeyword,
  playbackPlaceholderError,
  playbackIndex,
}: {
  initialData?: PlayPageData;
  playbackKeyword?: string;
  playbackPlaceholderError?: string;
  playbackIndex?: string;
} = {}) {
  const { message } = App.useApp();
  const [playbackData, setPlaybackData] = useState<PlayPageData | null>(
    initialData ?? null,
  );
  const placeholderMessage = playbackPlaceholderError ?? "播放信息不可用";
  const playbackCoverUrl = useMemo(() => {
    if (!playbackData) {
      return createPlaceholderImageUrl({
        variant: "poster",
        fileStem: env.NEXT_PUBLIC_SITE_NAME,
        seed: "playback-placeholder",
      });
    }

    const posterUrl = playbackData.cover_default.trim();

    if (posterUrl) {
      return posterUrl;
    }

    return createPlaceholderImageUrl({
      variant: "poster",
      fileStem: playbackData.title || env.NEXT_PUBLIC_SITE_NAME,
      seed: `${playbackData.progress_source}-${playbackData.progress_id}`,
    });
  }, [playbackData]);
  const playbackCoverDefaultUrl = useMemo(() => {
    if (!playbackData) {
      return createPlaceholderImageUrl({
        variant: "poster",
        fileStem: env.NEXT_PUBLIC_SITE_NAME,
        seed: "playback-placeholder",
      });
    }

    return playbackData.cover_default.trim() || playbackCoverUrl;
  }, [playbackData, playbackCoverUrl]);
  const hasPlaybackPlaceholderError =
    Boolean(playbackPlaceholderError) || !playbackData;
  const artContainerRef = useRef<HTMLDivElement>(null);
  const artPlayerRef = useRef<Artplayer | null>(null);
  const hasAppliedResumeTimeRef = useRef(false);
  const hasPlaybackStartedRef = useRef(false);
  const initialResumeTimeSeconds = normalizeResumeTime(playbackData?.play_time);
  const [activeEpisode, setActiveEpisode] = useState(
    playbackData?.play_episodes ?? 1,
  );
  const [activeSource, setActiveSource] = useState(
    playbackData?.sources[(playbackData?.play_episodes ?? 1) - 1]?.id ??
      playbackData?.sources[0]?.id ??
      "",
  );
  const [selectedGroupKey, setSelectedGroupKey] = useState(() =>
    playbackData
      ? getEpisodeGroupKeyForEpisode(
          playbackData.episodes,
          playbackData.play_episodes,
        )
      : "",
  );
  const [selectedTabKey, setSelectedTabKey] = useState("episodes");
  const [isDescending, setIsDescending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(readStoredPlaybackVolume);
  const [isStrongBuffering, setIsStrongBuffering] = useState<boolean>(
    readStoredStrongBuffering,
  );
  const [danmakuPreferences, setDanmakuPreferences] =
    useState<PlaybackDanmakuPreferences>(readStoredPlaybackDanmakuSettings);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(
    Boolean(playbackData?.is_favorite),
  );
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [playbackSourceOptions, setPlaybackSourceOptions] = useState<
    PlaybackSourceOption[]
  >([]);
  const [placeholderSourceOptions, setPlaceholderSourceOptions] = useState<
    PlaybackSourceOption[]
  >([]);
  const [placeholderSourceLoading, setPlaceholderSourceLoading] =
    useState(false);
  const [placeholderSourceError, setPlaceholderSourceError] = useState<
    string | null
  >(null);
  const [isSourceSwitching, setIsSourceSwitching] = useState(false);
  const danmakuPreferencesRef = useRef(danmakuPreferences);
  const activeEpisodeRef = useRef(activeEpisode);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const shouldResumePlaybackRef = useRef(false);
  const currentPlaybackSecondsRef = useRef(initialResumeTimeSeconds);
  const currentPlaybackDurationRef = useRef(playbackDurationSeconds);
  const currentPlaybackUrlRef = useRef("");
  const initialResumeTimeSecondsRef = useRef(initialResumeTimeSeconds);
  const danmakuSegmentsRef = useRef<PlaybackDanmakuSegment[]>([]);
  const loadedDanmakuSegmentIndexesRef = useRef<Set<number>>(new Set());
  const activeDanmakuEpisodeRef = useRef<number>(activeEpisode);

  const episodeGroups = useMemo(
    () => (playbackData ? getEpisodeGroups(playbackData.episodes) : []),
    [playbackData],
  );
  const selectedGroup =
    episodeGroups.find((group) => group.key === selectedGroupKey) ??
    episodeGroups[0];
  const visibleEpisodes = selectedGroup
    ? isDescending
      ? [...selectedGroup.episodes].reverse()
      : selectedGroup.episodes
    : [];
  const currentSource =
    playbackData?.sources.find((source) => source.id === activeSource) ??
    playbackData?.sources[0];
  const currentSourceName =
    playbackData?.source_name.trim() || currentSource?.name.trim() || "";
  const currentPlaybackUrl =
    currentSource?.url ??
    playbackData?.sources[activeEpisode - 1]?.url ??
    playbackData?.sources[0]?.url ??
    "";
  const hasPlayablePlaybackData =
    !hasPlaybackPlaceholderError && Boolean(playbackData);
  const currentPlaybackDanmakuUrl = createPlaybackDanmakuUrl({
    title: playbackData?.title ?? "",
    playEpisodes: activeEpisode,
  });
  const progressEndpoint = useMemo(() => {
    const progressSource = playbackData?.progress_source;
    const progressId = playbackData?.progress_id;

    if (!progressSource || !progressId) {
      return "";
    }

    return `/api/play/progress/${encodeURIComponent(progressSource)}/${encodeURIComponent(progressId)}`;
  }, [playbackData]);
  const progressEndpointRef = useRef(progressEndpoint);
  const playbackActionsRef = useRef<{
    skipPlayback: (seconds: number) => void;
    playNextEpisode: () => void;
  }>({
    skipPlayback: () => undefined,
    playNextEpisode: () => undefined,
  });
  useEffect(() => {
    currentPlaybackUrlRef.current = currentPlaybackUrl;
  }, [currentPlaybackUrl]);
  useEffect(() => {
    initialResumeTimeSecondsRef.current = initialResumeTimeSeconds;
  }, [initialResumeTimeSeconds]);
  useEffect(() => {
    progressEndpointRef.current = progressEndpoint;
  }, [progressEndpoint]);
  const setPlaybackPosterVisible = useCallback(
    (art: Artplayer, visible: boolean) => {
      const posterElement = artContainerRef.current?.querySelector(
        ".art-poster",
      ) as HTMLDivElement | null;

      if (posterElement) {
        posterElement.style.display = visible ? "" : "none";
      }
    },
    [],
  );
  const loadPlaybackDanmaku = useCallback(async (): Promise<PlaybackDanmakuResult> => {
    if (!currentPlaybackDanmakuUrl) {
      return { loadMode: "full", items: [], segments: [] };
    }

    try {
      const response = await fetch(currentPlaybackDanmakuUrl, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return { loadMode: "full", items: [], segments: [] };
      }

      const payload = (await response.json()) as unknown;

      return readPlaybackDanmakuResult(payload);
    } catch {
      return { loadMode: "full", items: [], segments: [] };
    }
  }, [currentPlaybackDanmakuUrl]);
  const loadDanmakuSegmentByIndex = useCallback(async (index: number) => {
    const segment = danmakuSegmentsRef.current[index];

    if (!segment || loadedDanmakuSegmentIndexesRef.current.has(index)) {
      return;
    }

    const art = artPlayerRef.current;

    if (!art) {
      return;
    }

    const danmakuPlugin = getArtplayerDanmakuPlugin(art);

    if (!danmakuPlugin) {
      return;
    }

    const segmentUrl = playbackDanmakuSegmentEndpoint;

    loadedDanmakuSegmentIndexesRef.current.add(index);

    try {
      const response = await fetch(segmentUrl, {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ segment }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as unknown;
      const record = payload as { items?: unknown } | null;
      const items = readPlaybackDanmakuItems(record?.items);

      if (artPlayerRef.current !== art || !items.length) {
        return;
      }

      await danmakuPlugin.load(items);
    } catch {
      // 分片加载失败不中断播放，后续 timeupdate 会重试相邻分片。
    }
  }, []);
  const preloadUpcomingDanmakuSegments = useCallback(() => {
    const currentTime = currentPlaybackSecondsRef.current;
    const segments = danmakuSegmentsRef.current;

    if (!segments.length) {
      return;
    }

    // 预加载当前播放时间所在分片及下一个分片，保证边播边有弹幕。
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];

      if (currentTime < segment.end) {
        void loadDanmakuSegmentByIndex(index);
        void loadDanmakuSegmentByIndex(index + 1);
        return;
      }
    }
  }, [loadDanmakuSegmentByIndex]);
  const loadPlaybackDanmakuIntoPlugin = useCallback(async () => {
    const art = artPlayerRef.current;

    if (!art) {
      return;
    }

    const danmakuPlugin = getArtplayerDanmakuPlugin(art);

    if (!danmakuPlugin) {
      return;
    }

    const result = await loadPlaybackDanmaku();

    if (artPlayerRef.current !== art) {
      return;
    }

    activeDanmakuEpisodeRef.current = activeEpisode;
    danmakuSegmentsRef.current = [];
    loadedDanmakuSegmentIndexesRef.current = new Set();

    // 无参 load() 清空旧弹幕队列，避免切集残留。
    await danmakuPlugin.load();

    if (result.loadMode === "segment") {
      danmakuSegmentsRef.current = result.segments;

      // 首屏立即加载前两个分片（覆盖前 120 秒），其余随播放进度补齐。
      void loadDanmakuSegmentByIndex(0);
      void loadDanmakuSegmentByIndex(1);
      return;
    }

    if (result.items.length) {
      await danmakuPlugin.load(result.items);
    }
  }, [activeEpisode, loadPlaybackDanmaku, loadDanmakuSegmentByIndex]);
  const loadPlaybackDanmakuIntoPluginRef = useRef(
    loadPlaybackDanmakuIntoPlugin,
  );
  useEffect(() => {
    loadPlaybackDanmakuIntoPluginRef.current = loadPlaybackDanmakuIntoPlugin;
  }, [loadPlaybackDanmakuIntoPlugin]);
  const preloadUpcomingDanmakuSegmentsRef = useRef(
    preloadUpcomingDanmakuSegments,
  );
  useEffect(() => {
    preloadUpcomingDanmakuSegmentsRef.current = preloadUpcomingDanmakuSegments;
  }, [preloadUpcomingDanmakuSegments]);
  useEffect(() => {
    danmakuPreferencesRef.current = danmakuPreferences;
  }, [danmakuPreferences]);
  const uploadPlaybackProgress = useCallback(() => {
    const art = artPlayerRef.current;
    const currentProgressEndpoint = progressEndpointRef.current;

    if (
      !currentProgressEndpoint ||
      hasPlaybackPlaceholderError ||
      !art ||
      !playbackData
    ) {
      return;
    }

    const playTime = Math.floor(
      Math.max(0, art.currentTime || currentPlaybackSecondsRef.current),
    );
    const totalTime = Math.floor(
      Math.max(0, art.duration || currentPlaybackDurationRef.current),
    );

    void fetch(currentProgressEndpoint, {
      body: JSON.stringify({
        play_episodes: activeEpisodeRef.current,
        play_time: playTime,
        total_time: totalTime,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [hasPlaybackPlaceholderError, playbackData]);
  const uploadPlaybackProgressRef = useRef(uploadPlaybackProgress);
  useEffect(() => {
    uploadPlaybackProgressRef.current = uploadPlaybackProgress;
  }, [uploadPlaybackProgress]);
  useEffect(() => {
    if (!playbackData?.index || !playbackData.title.trim()) {
      return;
    }

    const controller = new AbortController();
    const seen = new Map<string, PlaybackSourceOption>();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setPlaybackSourceOptions([]);
      }
    });

    void fetch(
      createPlaybackSourcesUrl({
        index: playbackData.index,
        keyword: playbackData.title,
      }),
      {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        await readPlaybackSourceOptions(
          response,
          (source) => {
            upsertPlaybackSourceOption(
              source,
              seen,
              setPlaybackSourceOptions,
              controller.signal,
            );
          },
          controller.signal,
        );
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [playbackData?.index, playbackData?.title]);
  useEffect(() => {
    if (
      !hasPlaybackPlaceholderError ||
      !playbackIndex?.trim() ||
      !playbackKeyword?.trim()
    ) {
      return;
    }

    const controller = new AbortController();
    const seen = new Map<string, PlaybackSourceOption>();
    queueMicrotask(() => {
      setPlaceholderSourceLoading(true);
      setPlaceholderSourceError(null);
      setPlaceholderSourceOptions([]);
    });

    void fetch(
      createPlaybackSourcesUrl({
        index: playbackIndex,
        keyword: playbackKeyword,
      }),
      {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load playback sources.");
        }

        await readPlaybackSourceOptions(
          response,
          (source) => {
            upsertPlaybackSourceOption(
              source,
              seen,
              setPlaceholderSourceOptions,
              controller.signal,
            );
          },
          controller.signal,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlaceholderSourceError("未能加载可用片源，请稍后重试。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPlaceholderSourceLoading(false);
        }
      });

    return () => controller.abort();
  }, [hasPlaybackPlaceholderError, playbackIndex, playbackKeyword]);
  const switchPlaybackSource = useCallback(
    async (source: PlaybackSourceOption) => {
      if (!playbackData || isSourceSwitching) {
        return;
      }

      const currentTime = Math.floor(
        Math.max(0, currentPlaybackSecondsRef.current),
      );
      const totalTime = Math.floor(
        Math.max(0, currentPlaybackDurationRef.current),
      );

      setIsSourceSwitching(true);
      setPlaybackError(null);

      try {
        const response = await fetch("/api/play/source-switch", {
          body: JSON.stringify({
            currentId: playbackData.progress_id,
            currentSource: playbackData.progress_source,
            play_episodes: activeEpisodeRef.current,
            play_time: currentTime,
            targetId: source.id,
            targetSource: source.key,
            total_time: totalTime,
          }),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          message.error(data?.message ?? "切换源失败，请稍后重试。");
          return;
        }

        const data = (await response.json()) as PlaybackSourceSwitchResponse;
        const nextPlayEpisodes = data.progress.play_episodes;
        const nextSourceId =
          data.sources[nextPlayEpisodes - 1]?.id ?? data.sources[0]?.id ?? "";
        const nextUrl = createPlayUrl({
          id: data.progress.id,
          source: data.progress.source,
        });
        progressEndpointRef.current = `/api/play/progress/${encodeURIComponent(data.progress.source)}/${encodeURIComponent(data.progress.id)}`;

        setPlaybackData((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            area: data.source_name || current.area,
            episodes: data.episodes,
            play_episodes: nextPlayEpisodes,
            play_time: data.progress.play_time,
            progress_id: data.progress.id,
            progress_source: data.progress.source,
            source_name: data.source_name || current.source_name,
            sources: data.sources,
          };
        });

        setActiveEpisode(nextPlayEpisodes);
        setActiveSource(nextSourceId);
        setSelectedGroupKey(
          getEpisodeGroupKeyForEpisode(data.episodes, nextPlayEpisodes),
        );
        currentPlaybackSecondsRef.current = data.progress.play_time;
        currentPlaybackDurationRef.current = totalTime;
        hasAppliedResumeTimeRef.current = false;
        hasPlaybackStartedRef.current = false;

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", nextUrl);
        }
      } catch {
        message.error("切换源失败，请稍后重试。");
      } finally {
        setIsSourceSwitching(false);
      }
    },
    [isSourceSwitching, message, playbackData],
  );
  useEffect(() => {
    if (
      !playbackData?.progress_id ||
      !playbackData?.progress_source ||
      typeof window === "undefined"
    ) {
      return;
    }

    const nextUrl = createPlayUrl({
      id: playbackData.progress_id,
      source: playbackData.progress_source,
    });

    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [playbackData?.progress_id, playbackData?.progress_source]);
  const resetPlaybackForEpisode = useCallback(
    (episodeNumber: number) => {
      const art = artPlayerRef.current;

      if (!playbackData) {
        return;
      }

      shouldResumePlaybackRef.current = isPlayingRef.current;
      hasPlaybackStartedRef.current = false;

      setPlaybackData((current) =>
        current
          ? {
              ...current,
              play_episodes: episodeNumber,
              play_time: 0,
            }
          : current,
      );
      setActiveEpisode(episodeNumber);
      setSelectedGroupKey(
        getEpisodeGroupKeyForEpisode(playbackData.episodes, episodeNumber),
      );
      setActiveSource(
        playbackData.sources[episodeNumber - 1]?.id ??
          playbackData.sources[0]?.id ??
          "",
      );
      currentPlaybackSecondsRef.current = 0;
      setPlaybackError(null);
      setIsPlaying(false);

      if (art) {
        art.pause();
        art.currentTime = 0;
        art.poster = playbackCoverDefaultUrl;
        setPlaybackPosterVisible(art, true);
      }
    },
    [playbackData, playbackCoverDefaultUrl, setPlaybackPosterVisible],
  );
  const playNextEpisode = useCallback(() => {
    if (!playbackData) {
      return;
    }

    const currentIndex = playbackData.episodes.findIndex(
      (episode) => episode.number === activeEpisode,
    );
    const nextEpisode = playbackData.episodes[currentIndex + 1];

    if (!nextEpisode) {
      return;
    }

    resetPlaybackForEpisode(nextEpisode.number);
  }, [activeEpisode, playbackData, resetPlaybackForEpisode]);
  const skipPlayback = useCallback((seconds: number) => {
    const art = artPlayerRef.current;
    const maxSeconds =
      currentPlaybackDurationRef.current > 0
        ? currentPlaybackDurationRef.current
        : playbackDurationSeconds;

    if (!art) {
      currentPlaybackSecondsRef.current = clamp(
        currentPlaybackSecondsRef.current + seconds,
        0,
        maxSeconds,
      );
      return;
    }

    const nextTime = clamp(art.currentTime + seconds, 0, maxSeconds);
    art.currentTime = nextTime;
    currentPlaybackSecondsRef.current = nextTime;
  }, []);
  useEffect(() => {
    playbackActionsRef.current = {
      skipPlayback,
      playNextEpisode,
    };
  }, [playNextEpisode, skipPlayback]);
  const capturePlaybackCover = useCallback(
    (art: Artplayer) => {
      if (hasPlaybackStartedRef.current) {
        return;
      }

      const video = art.video;

      if (
        !video.videoWidth ||
        !video.videoHeight ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        art.poster = canvas.toDataURL("image/jpeg", 0.82);
        setPlaybackPosterVisible(art, !art.playing);
      } catch {
        art.poster = playbackCoverDefaultUrl;
        setPlaybackPosterVisible(art, !art.playing);
      }
    },
    [playbackCoverDefaultUrl, setPlaybackPosterVisible],
  );
  const capturePlaybackCoverRef = useRef(capturePlaybackCover);
  useEffect(() => {
    capturePlaybackCoverRef.current = capturePlaybackCover;
  }, [capturePlaybackCover]);
  const toggleStrongBuffering = useCallback((enabled: boolean) => {
    const art = artPlayerRef.current;

    if (art) {
      currentPlaybackSecondsRef.current = Math.max(0, art.currentTime || 0);
      currentPlaybackDurationRef.current = Math.max(0, art.duration || 0);
      shouldResumePlaybackRef.current = isPlayingRef.current;
    }

    hasAppliedResumeTimeRef.current = false;
    setIsStrongBuffering(enabled);
    storeStrongBuffering(enabled);
  }, []);
  const playerSettings = useMemo<Setting[]>(
    () => [
      {
        name: "mixtv-strong-buffering",
        html: "强力缓冲",
        tooltip: isStrongBuffering ? "开启" : "关闭",
        switch: isStrongBuffering,
        onSwitch(item: SettingOption) {
          const nextValue = !item.switch;

          toggleStrongBuffering(nextValue);

          return nextValue;
        },
      },
      {
        name: "mixtv-playback-rate",
        html: "播放速度",
        tooltip: formatPlaybackRateLabel(1),
        selector: playbackRateOptions.map((rate) => ({
          name: `mixtv-playback-rate-${rate}`,
          value: rate,
          default: rate === 1,
          html: formatPlaybackRateLabel(rate),
        })),
        onSelect(item: SettingOption) {
          const nextRate = Number(item.value);

          if (Number.isFinite(nextRate) && nextRate > 0) {
            this.playbackRate = nextRate;
          }

          return typeof item.html === "string"
            ? item.html
            : formatPlaybackRateLabel(this.playbackRate);
        },
      },
    ],
    [isStrongBuffering, toggleStrongBuffering],
  );

  useEffect(() => {
    const container = artContainerRef.current;

    if (!hasPlayablePlaybackData || !container) {
      return;
    }

    let isMounted = true;
    setPlaybackError(null);
    hasAppliedResumeTimeRef.current = false;

    void Promise.all([
      import("artplayer"),
      import("artplayer-plugin-danmuku"),
    ]).then(
      ([
        { default: ArtplayerConstructor },
        { default: artplayerPluginDanmuku },
      ]) => {
        if (!isMounted || !artContainerRef.current) {
          return;
        }

        const art = new ArtplayerConstructor({
          container: artContainerRef.current,
          url: currentPlaybackUrlRef.current,
          type: "m3u8",
          poster: playbackCoverDefaultUrl,
          volume: defaultPlaybackVolume / 100,
          muted: defaultPlaybackVolume === 0,
          playbackRate: false,
          setting: true,
          hotkey: true,
          fullscreen: true,
          fullscreenWeb: true,
          miniProgressBar: false,
          playsInline: true,
          moreVideoAttr: {
            crossOrigin: "anonymous",
            preload: "auto",
          },
          settings: playerSettings,
          plugins: [
            artplayerPluginDanmuku({
              danmuku: [] as Danmu[],
              ...danmakuPreferencesRef.current,
            }),
          ],
          customType: {
            m3u8(video, url, artInstance) {
              const player = artInstance as ArtplayerWithHls;

              player.hls?.destroy();
              player.hls = undefined;

              if (Hls.isSupported()) {
                const hls = new Hls(
                  createHlsBufferConfig(isStrongBuffering),
                );

                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.ERROR, (_event, data) => {
                  if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                      hls.startLoad();
                      return;
                    }

                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                      hls.recoverMediaError();
                      return;
                    }

                    setPlaybackError("视频加载失败，请稍后重试或切换线路。");
                  }
                });

                player.hls = hls;
                artInstance.on("destroy", () => hls.destroy());
                return;
              }

              if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.preload = "auto";
                video.src = url;
                video.load();
                return;
              }

              setPlaybackError("当前浏览器不支持 HLS 播放。");
            },
          },
        });

        artPlayerRef.current = art;
        art.playbackRate = 1;
        art.volume = volumeRef.current / 100;
        art.muted = volumeRef.current === 0;
        art.controls.add({
          name: "mixtv-skip-backward",
          html: renderToStaticMarkup(<FastBackwardFilled />),
          position: "left",
          index: 11,
          tooltip: "快退 10 秒",
          click: () => playbackActionsRef.current.skipPlayback(-10),
        });
        art.controls.add({
          name: "mixtv-skip-forward",
          html: renderToStaticMarkup(<FastForwardFilled />),
          position: "left",
          index: 12,
          tooltip: "快进 10 秒",
          click: () => playbackActionsRef.current.skipPlayback(10),
        });
        art.controls.add({
          name: "mixtv-next-episode",
          html: renderToStaticMarkup(<ForwardOutlined />),
          position: "left",
          index: 13,
          tooltip: "下一集",
          click: () => playbackActionsRef.current.playNextEpisode(),
        });
        art.on("video:loadedmetadata", () => {
          if (Number.isFinite(art.duration) && art.duration > 0) {
            currentPlaybackDurationRef.current = art.duration;
          }
          const resumeTimeSeconds =
            currentPlaybackSecondsRef.current ||
            initialResumeTimeSecondsRef.current;
          if (
            !hasAppliedResumeTimeRef.current &&
            resumeTimeSeconds > 0
          ) {
            const nextTime =
              Number.isFinite(art.duration) && art.duration > 0
                ? clamp(resumeTimeSeconds, 0, art.duration)
                : resumeTimeSeconds;

            hasAppliedResumeTimeRef.current = true;
            art.currentTime = nextTime;
            currentPlaybackSecondsRef.current = nextTime;
          }
        });
        art.on("video:durationchange", () => {
          if (Number.isFinite(art.duration) && art.duration > 0) {
            currentPlaybackDurationRef.current = art.duration;
          }
        });
        art.on("video:timeupdate", () => {
          currentPlaybackSecondsRef.current = art.currentTime;
          preloadUpcomingDanmakuSegmentsRef.current();
        });
        art.on("video:loadeddata", () => capturePlaybackCoverRef.current(art));
        art.on("video:seeked", () => {
          capturePlaybackCoverRef.current(art);
          uploadPlaybackProgressRef.current();
        });
        art.on("video:play", () => {
          setPlaybackError(null);
          setIsPlaying(true);
          hasPlaybackStartedRef.current = true;
          art.poster = "";
          setPlaybackPosterVisible(art, false);
        });
        art.on("video:pause", () => {
          setIsPlaying(false);
          uploadPlaybackProgressRef.current();
        });
        art.on("video:ended", () => {
          uploadPlaybackProgressRef.current();
          playbackActionsRef.current.playNextEpisode();
        });
        art.on("video:canplay", () => {
          capturePlaybackCoverRef.current(art);
        });
        art.on("video:canplaythrough", () => {
          capturePlaybackCoverRef.current(art);
        });
        art.on("fullscreenWeb", (state) => setIsWebFullscreen(state));
        art.on("video:volumechange", () => {
          const nextVolume = Math.round(art.volume * 100);

          setVolume(nextVolume);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              playbackVolumeStorageKey,
              String(nextVolume),
            );
          }
        });
        art.on("artplayerPluginDanmuku:config", (option) => {
          const nextPreferences = normalizePlaybackDanmakuPreferences(option);

          setDanmakuPreferences(nextPreferences);
          storePlaybackDanmakuSettings(nextPreferences);
        });
        art.on("error", () => {
          setPlaybackError("视频加载失败，请稍后重试或切换线路。");
        });

        if (shouldResumePlaybackRef.current || isPlayingRef.current) {
          shouldResumePlaybackRef.current = false;
          void art.play();
        }

        void loadPlaybackDanmakuIntoPluginRef.current();
      },
    );

    return () => {
      isMounted = false;
      artPlayerRef.current?.destroy(false);
      artPlayerRef.current = null;
    };
    // Keep the Artplayer instance mounted across episode/source URL changes so
    // browser fullscreen is not torn down while switching videos.
  }, [
    hasPlayablePlaybackData,
    isStrongBuffering,
    playbackCoverDefaultUrl,
    playerSettings,
    setPlaybackPosterVisible,
  ]);

  useEffect(() => {
    activeEpisodeRef.current = activeEpisode;
  }, [activeEpisode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalId = window.setInterval(uploadPlaybackProgress, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, uploadPlaybackProgress]);

  useEffect(() => {
    const handlePageHide = () => uploadPlaybackProgress();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        uploadPlaybackProgress();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [uploadPlaybackProgress]);

  useEffect(() => {
    volumeRef.current = volume;

    if (!artPlayerRef.current) {
      return;
    }

    artPlayerRef.current.volume = volume / 100;
    artPlayerRef.current.muted = volume === 0;
  }, [volume]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(playbackVolumeStorageKey, String(volume));
  }, [volume]);

  useEffect(() => {
    storePlaybackDanmakuSettings(danmakuPreferences);
  }, [danmakuPreferences]);

  useEffect(() => {
    void loadPlaybackDanmakuIntoPlugin();
  }, [activeEpisode, loadPlaybackDanmakuIntoPlugin]);

  const toggleFavorite = useCallback(async () => {
    if (isFavoritePending) {
      return;
    }

    setIsFavoritePending(true);

    try {
      if (!playbackData) {
        return;
      }

      const response = await fetch(
        `/api/favorites/${encodeURIComponent(playbackData.progress_source)}/${encodeURIComponent(playbackData.progress_id)}`,
        {
          headers: { Accept: "application/json" },
          method: isFavorite ? "DELETE" : "POST",
        },
      );

      if (!response.ok) {
        return;
      }

      setIsFavorite((value) => !value);
    } catch {
      // Keep the current local favorite state when the API call fails.
    } finally {
      setIsFavoritePending(false);
    }
  }, [isFavorite, isFavoritePending, playbackData]);

  useEffect(() => {
    const art = artPlayerRef.current;

    if (!art || !currentSource || art.url === currentSource.url) {
      return;
    }

    const shouldResumePlayback =
      shouldResumePlaybackRef.current || isPlayingRef.current;
    shouldResumePlaybackRef.current = false;
    hasAppliedResumeTimeRef.current = false;
    if (art) {
      art.poster = playbackCoverDefaultUrl;
      setPlaybackPosterVisible(art, true);
    }
    setPlaybackError(null);

    void art
      .switchUrl(currentSource.url)
      .then(() => {
        if (shouldResumePlayback) {
          void art.play();
        }
      })
      .catch(() => {
        setPlaybackError("切换线路失败，请稍后重试。");
      });
  }, [currentSource, playbackCoverDefaultUrl, setPlaybackPosterVisible]);

  const renderPlaybackTabLabel = useCallback(
    ({
      glowClassName,
      icon,
      isSelected,
      title,
    }: {
      glowClassName: TabGlowClassName;
      icon: ReactNode;
      isSelected: boolean;
      title: string;
    }) => {
      return (
        <span
          className={`relative z-0 flex h-14 w-full items-center justify-center overflow-hidden text-sm font-semibold tracking-normal transition-colors before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:-z-10 before:h-[72px] before:w-[88%] before:-translate-x-1/2 before:-translate-y-1/2 before:opacity-0 before:blur-[2px] before:transition-opacity ${glowClassName} ${
            isSelected
              ? "text-accent before:opacity-100"
              : "text-default-500 hover:text-foreground"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-1/2 top-1/2 -z-10 h-8 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] blur-[3px] transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0"
            }`}
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            {icon}
            {title}
          </span>
        </span>
      );
    },
    [],
  );

  const playbackTabs = [
    {
      children: (
        <div className="grid gap-4 p-4 md:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
            <div className="flex min-w-0 gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {episodeGroups.map((group) => (
                <Button
                  key={group.key}
                  className="shrink-0"
                  size="small"
                  type={group.key === selectedGroupKey ? "primary" : "default"}
                  onClick={() => setSelectedGroupKey(group.key)}
                >
                  {group.label}
                </Button>
              ))}
            </div>
            <Button
              aria-label={isDescending ? "切换为正序" : "切换为倒序"}
              className="h-8 w-8 min-w-0 p-0"
              size="small"
              type="default"
              onClick={() => setIsDescending((value) => !value)}
            >
              {isDescending ? (
                <SortDescendingOutlined />
              ) : (
                <SortAscendingOutlined />
              )}
            </Button>
          </div>

          <Divider size="small" className="m-0" />

          <div className="grid max-h-107.5 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 xl:grid-cols-5">
            {visibleEpisodes.map((episode) => (
              <button
                key={episode.number}
                type="button"
                aria-label={`${episode.title} ${episode.duration}`}
                className={`h-7 min-w-14 cursor-pointer rounded border px-3 text-sm font-medium transition-colors ${
                  episode.number === activeEpisode
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-default-200 bg-surface-secondary text-accent hover:bg-surface hover:text-foreground"
                }`}
                onClick={() => resetPlaybackForEpisode(episode.number)}
              >
                {episode.number}
              </button>
            ))}
          </div>
        </div>
      ),
      glowClassName: tabGlowClassNames[0],
      icon: <PlaySquareFilled />,
      key: "episodes",
      title: "选集",
    },
    {
      children: (
        <div className="grid max-h-122.5 gap-3 overflow-y-auto p-4 pr-3 md:p-5 md:pr-4">
          {playbackSourceOptions.length > 0 && (
            <>
              {playbackSourceOptions.map((source) => {
                const isCurrentSource =
                  source.key === playbackData?.progress_source &&
                  source.id === playbackData?.progress_id;

                return (
                  <button
                    key={`${source.key}:${source.id}`}
                    type="button"
                    className={`relative grid cursor-pointer gap-3 rounded-lg border p-4 text-left transition-colors ${
                      isCurrentSource
                        ? "border-accent bg-accent/10"
                        : "border-accent/20 bg-surface-secondary/50 hover:border-accent hover:bg-surface"
                    }`}
                    disabled={isSourceSwitching}
                    onClick={() => switchPlaybackSource(source)}
                  >
                    {isCurrentSource ? (
                      <Tag
                        color="success"
                        variant="solid"
                        className="absolute right-3 top-3"
                      >
                        当前源
                      </Tag>
                    ) : null}
                    <span className="flex min-w-0 items-center gap-3 pr-16">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {source.name}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-3 text-xs text-default-500">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        {source.quality ? (
                          <Tag color="processing">{source.quality}</Tag>
                        ) : null}
                        <Tag color={getPlaybackSourcePingTagColor(source.ping)}>
                          延迟 {formatPlaybackSourcePing(source.ping)}
                        </Tag>
                      </span>
                      <Tag>{source.total_episodes} 集</Tag>
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      ),
      glowClassName: tabGlowClassNames[1],
      icon: <GlobalOutlined />,
      key: "sources",
      title: "换源",
    },
  ] as const;
  const activePlaybackTab =
    playbackTabs.find((tab) => tab.key === selectedTabKey) ?? playbackTabs[0];
  const selectPlaybackTab = useCallback((key: string) => {
    setSelectedTabKey(key);
  }, []);

  if (hasPlaybackPlaceholderError || !playbackData) {
    return (
      <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-400 gap-5">
          <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-default-200/70 bg-surface px-6 text-center shadow-sm">
            <div className="grid w-full max-w-6xl justify-items-center gap-5 py-8">
              <div className="grid max-w-2xl justify-items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-full border border-white/12 bg-white/8 text-2xl text-red-300">
                  <WarningOutlined />
                </span>
                <h1 className="text-lg font-semibold tracking-normal">
                  播放信息不可用
                </h1>
                <p className="text-sm leading-6 text-default-500">
                  {placeholderMessage}
                </p>
              </div>
              {playbackIndex?.trim() && playbackKeyword?.trim() ? (
                <section className="grid w-full gap-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-default-700">
                      可用片源
                    </h2>
                    {placeholderSourceLoading ? (
                      <span className="text-xs text-default-400">
                        正在加载...
                      </span>
                    ) : null}
                  </div>
                  {placeholderSourceError ? (
                    <p className="text-sm text-red-300">
                      {placeholderSourceError}
                    </p>
                  ) : null}
                  {!placeholderSourceLoading &&
                  placeholderSourceOptions.length === 0 &&
                  !placeholderSourceError ? (
                    <p className="text-sm text-default-400">
                      没有找到可切换的片源。
                    </p>
                  ) : null}
                  <div
                    role="list"
                    aria-label="可用片源列表"
                    className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                  >
                    {placeholderSourceOptions.map((source) => {
                      const sourceName =
                        source.name.trim() ||
                        source.source_name.trim() ||
                        source.key;
                      const sourceProvider = source.source_name.trim() || "未知接口";
                      const sourceQuality = source.quality?.trim();

                      return (
                        <div key={`${source.key}:${source.id}`} role="listitem">
                          <a
                            className="group grid min-h-36 cursor-pointer content-between gap-4 rounded-lg border border-default-200 bg-surface-secondary/70 p-4 text-left transition-colors duration-200 hover:border-accent hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            href={createPlayUrl({
                              id: source.id,
                              source: source.key,
                            })}
                            title={`${sourceName} / ${source.key} / ${source.id}`}
                          >
                            <span className="grid min-w-0 gap-3">
                              <span className="flex min-w-0 items-start justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                                  {sourceName}
                                </span>
                                {sourceQuality ? (
                                  <Tag color="processing" className="m-0 shrink-0">
                                    {sourceQuality}
                                  </Tag>
                                ) : null}
                              </span>
                              <span className="grid gap-2 text-xs text-default-500">
                                <span className="flex min-w-0 items-center gap-2">
                                  <ApiOutlined aria-hidden="true" className="shrink-0 text-default-400" />
                                  <span className="min-w-0 truncate">
                                    {sourceProvider}
                                  </span>
                                </span>
                                <span className="grid grid-cols-2 gap-2">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <GlobalOutlined aria-hidden="true" className="shrink-0 text-default-400" />
                                    <span className="min-w-0 truncate">
                                      源 {source.key}
                                    </span>
                                  </span>
                                  <span className="flex min-w-0 items-center gap-2">
                                    <NumberOutlined aria-hidden="true" className="shrink-0 text-default-400" />
                                    <span className="min-w-0 truncate">
                                      ID {source.id}
                                    </span>
                                  </span>
                                </span>
                              </span>
                            </span>
                            <span className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-default-500">
                              <Tag
                                color={getPlaybackSourcePingTagColor(source.ping)}
                                className="m-0"
                              >
                                <ClockCircleOutlined aria-hidden="true" className="mr-1" />
                                延迟 {formatPlaybackSourcePing(source.ping)}
                              </Tag>
                              <Tag className="m-0">{source.total_episodes} 集</Tag>
                            </span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-400 gap-5">
        <nav
          aria-label="播放导航"
          className="flex min-w-0 items-center gap-2 text-sm text-default-500"
        >
          <span className="truncate font-medium text-default-600 transition-colors hover:text-accent">
            {playbackData.title}
          </span>
          <RightOutlined className="text-xs" />
          <span className="truncate text-foreground">
            第 {activeEpisode} 集
          </span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className={`relative aspect-video min-h-65 overflow-hidden bg-zinc-950 md:min-h-130 ${
              isWebFullscreen
                ? "fixed inset-x-0 top-16 z-50 aspect-auto h-[calc(100dvh-4rem)] min-h-0"
                : ""
            }`}
          >
            <div
              ref={artContainerRef}
              aria-label={`${playbackData.title} 第 ${activeEpisode} 集视频`}
              data-mixtv-artplayer="floating-glass-controls"
              className="absolute inset-0 z-20 h-full w-full bg-black"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/30" />
          </div>
          {playbackError ? (
            <p className="px-1 text-sm text-red-300">{playbackError}</p>
          ) : null}

          <div className="overflow-hidden rounded-xl bg-surface shadow-sm backdrop-blur">
            <div
              role="tablist"
              aria-label="播放侧栏"
              className="grid grid-cols-2 border-b border-(--ant-color-border)"
            >
              {playbackTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selectedTabKey === tab.key}
                  aria-controls={`playback-tab-panel-${tab.key}`}
                  id={`playback-tab-${tab.key}`}
                  className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-inherit outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset"
                  onClick={() => selectPlaybackTab(tab.key)}
                >
                  {renderPlaybackTabLabel({
                    glowClassName: tab.glowClassName,
                    icon: tab.icon,
                    isSelected: selectedTabKey === tab.key,
                    title: tab.title,
                  })}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`playback-tab-panel-${activePlaybackTab.key}`}
              aria-labelledby={`playback-tab-${activePlaybackTab.key}`}
            >
              {activePlaybackTab.children}
            </div>
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl bg-surface p-4 shadow-sm backdrop-blur md:grid-cols-[180px_minmax(0,1fr)] md:p-5">
          <div className="relative aspect-2/3 w-36 overflow-hidden rounded-lg bg-default-100 md:w-full">
            <Image
              src={playbackData.cover || playbackCoverDefaultUrl}
              alt={`${playbackData.title} 封面`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 180px"
              priority
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
                  {playbackData.title}
                </h2>
              </div>
              <Button
                aria-pressed={isFavorite}
                disabled={isFavoritePending}
                size="small"
                type={isFavorite ? "primary" : "default"}
                onClick={toggleFavorite}
              >
                {isFavorite ? <HeartFilled /> : <HeartOutlined />}
                {isFavorite ? "已收藏" : "收藏"}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {currentSourceName ? (
                <Tag
                  color="processing"
                  className="rounded-full px-3 text-sm font-semibold"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <GlobalOutlined />
                    {currentSourceName}
                  </span>
                </Tag>
              ) : null}
              {playbackData.tags.map((tag) => (
                <Tag key={tag} className="rounded-full px-2.5 text-[11px]">
                  {tag}
                </Tag>
              ))}
            </div>

            <Divider className="my-5" />

            <p className="mt-5 text-sm leading-7 text-default-600">
              {playbackData.description}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
