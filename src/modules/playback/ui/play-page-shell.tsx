"use client";

import {
  FastBackwardFilled,
  FastForwardFilled,
  GlobalOutlined,
  HeartFilled,
  HeartOutlined,
  PlaySquareFilled,
  RightOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { renderToStaticMarkup } from "react-dom/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import type Artplayer from "artplayer";
import type {
  Danmu,
  Option as DanmakuOption,
  Result as DanmakuPluginResult,
} from "artplayer-plugin-danmuku";
import Image from "next/image";
import { App, Button, Divider, Tag, Tabs } from "antd";
import { env } from "@/shared/env";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { Episode, PlayPageData } from "../domain/playback-page-data";
import { createPlaybackDanmakuUrl } from "../domain/playback-danmaku";

const episodeGroupSize = 50;
const playbackDurationSeconds = 45 * 60 + 8;
const defaultPlaybackVolume: number = 50;
const playbackVolumeStorageKey = "mixtv.playback.volume";
const playbackDanmakuStorageKey = "mixtv.playback.danmaku";
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
const tabBaseClassName =
  "group relative h-[72px] justify-center rounded-none text-sm font-medium transition-colors before:absolute before:inset-x-6 before:top-1/2 before:h-[72px] before:-translate-y-1/2 before:opacity-0 before:transition-opacity data-[selected]:text-accent data-[selected]:before:opacity-100";

const tabGlowClassNames = ["before:bg-accent/10"] as const;

type TabGlowClassName = (typeof tabGlowClassNames)[number];
type ArtplayerWithHls = Artplayer & { hls?: Hls };
type PlaybackSourceOption = {
  id: string;
  key: string;
  name: string;
  quality?: string;
  source_name: string;
  total_episodes: number;
};
type PlaybackSourceSseEvent =
  | { event: "start"; data: { total: number } }
  | { event: "result"; data: PlaybackSourceOption }
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

function getRandomTabGlowClass(
  currentClassName: TabGlowClassName,
): TabGlowClassName {
  const nextClassNames = tabGlowClassNames.filter(
    (className) => className !== currentClassName,
  );
  const candidates =
    nextClassNames.length > 0 ? nextClassNames : tabGlowClassNames;

  return (
    candidates[Math.floor(Math.random() * candidates.length)] ??
    tabGlowClassNames[0]
  );
}

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
        onResult(event.data);
      }
    }
  }
}

export function PlayPageShell({
  initialData,
  playbackPlaceholderError,
  playbackIndex,
}: {
  initialData?: PlayPageData;
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
  const [tabGlowClassName, setTabGlowClassName] = useState<TabGlowClassName>(
    tabGlowClassNames[0],
  );
  const [isDescending, setIsDescending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(readStoredPlaybackVolume);
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

    return `/api/playback/progress/${encodeURIComponent(progressSource)}/${encodeURIComponent(progressId)}`;
  }, [playbackData]);
  const playbackActionsRef = useRef<{
    skipPlayback: (seconds: number) => void;
    playNextEpisode: () => void;
  }>({
    skipPlayback: () => undefined,
    playNextEpisode: () => undefined,
  });
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
  const loadPlaybackDanmaku = useCallback(async () => {
    if (!currentPlaybackDanmakuUrl) {
      return [];
    }

    try {
      const response = await fetch(currentPlaybackDanmakuUrl, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as unknown;

      return readPlaybackDanmakuItems(payload);
    } catch {
      return [];
    }
  }, [currentPlaybackDanmakuUrl]);
  const loadPlaybackDanmakuIntoPlugin = useCallback(async () => {
    const art = artPlayerRef.current;

    if (!art) {
      return;
    }

    const danmakuPlugin = getArtplayerDanmakuPlugin(art);

    if (!danmakuPlugin) {
      return;
    }

    const danmaku = await loadPlaybackDanmaku();

    if (artPlayerRef.current !== art) {
      return;
    }

    await danmakuPlugin.load(danmaku);
  }, [loadPlaybackDanmaku]);
  useEffect(() => {
    danmakuPreferencesRef.current = danmakuPreferences;
  }, [danmakuPreferences]);
  const uploadPlaybackProgress = useCallback(() => {
    const art = artPlayerRef.current;

    if (
      !progressEndpoint ||
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

    void fetch(progressEndpoint, {
      body: JSON.stringify({
        play_episodes: activeEpisodeRef.current,
        play_time: playTime,
        total_time: totalTime,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [hasPlaybackPlaceholderError, playbackData, progressEndpoint]);
  useEffect(() => {
    if (!playbackData?.index) {
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
      `/api/play/sources?index=${encodeURIComponent(playbackData.index)}`,
      {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        await readPlaybackSourceOptions(
          response,
          (source) => {
            seen.set(`${source.key}:${source.id}`, source);
            setPlaybackSourceOptions(Array.from(seen.values()));
          },
          controller.signal,
        );
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [playbackData?.index]);
  useEffect(() => {
    if (!hasPlaybackPlaceholderError || !playbackIndex?.trim()) {
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
      `/api/play/sources?index=${encodeURIComponent(playbackIndex.trim())}`,
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
            seen.set(`${source.key}:${source.id}`, source);
            setPlaceholderSourceOptions(Array.from(seen.values()));
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
  }, [hasPlaybackPlaceholderError, playbackIndex]);
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
        const response = await fetch("/api/play/sources", {
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

  useEffect(() => {
    const container = artContainerRef.current;

    if (hasPlaybackPlaceholderError || !container || !playbackData) {
      return;
    }

    let isMounted = true;
    setPlaybackError(null);

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
          url: currentPlaybackUrl,
          type: "m3u8",
          poster: playbackCoverDefaultUrl,
          volume: defaultPlaybackVolume / 100,
          muted: defaultPlaybackVolume === 0,
          playbackRate: true,
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
                const hls = new Hls({
                  backBufferLength: 90,
                  enableWorker: true,
                  fragLoadingTimeOut: 20000,
                  lowLatencyMode: false,
                  manifestLoadingTimeOut: 15000,
                  maxBufferLength: 60,
                  maxMaxBufferLength: 120,
                });

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
                video.src = url;
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
          html: renderToStaticMarkup(<FastForwardFilled />),
          position: "left",
          index: 13,
          tooltip: "下一集",
          click: () => playbackActionsRef.current.playNextEpisode(),
        });
        art.on("video:loadedmetadata", () => {
          if (Number.isFinite(art.duration) && art.duration > 0) {
            currentPlaybackDurationRef.current = art.duration;
          }
          if (
            !hasAppliedResumeTimeRef.current &&
            initialResumeTimeSeconds > 0
          ) {
            const nextTime =
              Number.isFinite(art.duration) && art.duration > 0
                ? clamp(initialResumeTimeSeconds, 0, art.duration)
                : initialResumeTimeSeconds;

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
        });
        art.on("video:loadeddata", () => capturePlaybackCover(art));
        art.on("video:seeked", () => {
          capturePlaybackCover(art);
          uploadPlaybackProgress();
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
          uploadPlaybackProgress();
        });
        art.on("video:ended", () => {
          uploadPlaybackProgress();
          playNextEpisode();
        });
        art.on("video:canplay", () => {
          capturePlaybackCover(art);
        });
        art.on("video:canplaythrough", () => {
          capturePlaybackCover(art);
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

        void loadPlaybackDanmakuIntoPlugin();
      },
    );

    return () => {
      isMounted = false;
      artPlayerRef.current?.destroy(false);
      artPlayerRef.current = null;
    };
    // Intentionally initialize the Artplayer instance once per playback payload.
  }, [
    capturePlaybackCover,
    hasPlaybackPlaceholderError,
    initialResumeTimeSeconds,
    currentPlaybackUrl,
    loadPlaybackDanmakuIntoPlugin,
    playbackData,
    playbackCoverUrl,
    playbackCoverDefaultUrl,
    playNextEpisode,
    setPlaybackPosterVisible,
    uploadPlaybackProgress,
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

    currentPlaybackSecondsRef.current = 0;
    hasPlaybackStartedRef.current = false;
    if (art) {
      art.poster = playbackCoverDefaultUrl;
      setPlaybackPosterVisible(art, true);
    }
    setPlaybackError(null);
    hasAppliedResumeTimeRef.current = true;

    void art.switchUrl(currentSource.url).catch(() => {
      setPlaybackError("切换线路失败，请稍后重试。");
    });
  }, [currentSource, playbackCoverDefaultUrl, setPlaybackPosterVisible]);

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

          <Divider className="my-3" />

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
      label: (
        <span
          className={`relative inline-flex items-center gap-2 rounded-md px-5 py-2.5 transition-colors ${tabBaseClassName} ${tabGlowClassName}`}
        >
          <PlaySquareFilled />
          选集
        </span>
      ),
      key: "episodes",
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
      label: (
        <span
          className={`relative inline-flex items-center gap-2 rounded-md px-5 py-2.5 transition-colors ${tabBaseClassName} ${tabGlowClassName}`}
        >
          <GlobalOutlined />
          换源
        </span>
      ),
      key: "sources",
    },
  ] as const;

  if (hasPlaybackPlaceholderError || !playbackData) {
    return (
      <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-400 gap-5">
          <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-default-200/70 bg-surface px-6 text-center shadow-sm">
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
              {playbackIndex?.trim() ? (
                <div className="mt-4 grid w-full gap-3 text-left">
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
                  <div className="grid gap-3">
                    {placeholderSourceOptions.map((source) => (
                      <a
                        key={`${source.key}:${source.id}`}
                        className="grid gap-3 rounded-lg border border-default-200 bg-surface-secondary/50 p-4 text-left transition-colors hover:border-accent hover:bg-surface"
                        href={createPlayUrl({
                          id: source.id,
                          source: source.key,
                        })}
                      >
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
                            <span>{source.source_name}</span>
                          </span>
                          <Tag>{source.total_episodes} 集</Tag>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
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
              data-mixtv-artplayer
              className="absolute inset-0 z-20 h-full w-full bg-black [&_.art-video-player]:h-full [&_.art-video-player]:w-full [&_.art-bottom]:!absolute [&_.art-bottom]:!inset-auto [&_.art-bottom]:!bottom-4 [&_.art-bottom]:!left-1/2 [&_.art-bottom]:!right-auto [&_.art-bottom]:!top-auto [&_.art-bottom]:!translate-x-[-50%] [&_.art-bottom]:!w-[min(calc(100%-1.5rem),56rem)] [&_.art-bottom]:!min-h-24 [&_.art-bottom]:!max-h-28 [&_.art-bottom]:!rounded-2xl [&_.art-bottom]:!border [&_.art-bottom]:!border-white/15 [&_.art-bottom]:!bg-black/35 [&_.art-bottom]:!px-3 [&_.art-bottom]:!pt-3 [&_.art-bottom]:!pb-0 [&_.art-bottom]:!shadow-lg [&_.art-bottom]:!backdrop-blur-2xl [&_.art-bottom]:!backdrop-saturate-200 [&_.art-bottom]:!flex [&_.art-bottom]:!flex-col [&_.art-bottom]:!justify-center [&_.art-bottom]:!overflow-visible dark:[&_.art-bottom]:!bg-black/45 [&_.art-progress]:!m-0 [&_.art-progress]:!overflow-visible [&_.art-controls]:!min-h-8 [&_.art-controls-left]:!items-center [&_.art-controls-center]:!items-center [&_.art-controls-right]:!items-center [&_.art-controls-left]:!gap-1"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/30" />
          </div>
          {playbackError ? (
            <p className="px-1 text-sm text-red-300">{playbackError}</p>
          ) : null}

          <div className="overflow-hidden rounded-xl bg-surface shadow-sm backdrop-blur">
            <Tabs
              activeKey={selectedTabKey}
              className="w-full"
              items={playbackTabs.map((item) => ({
                children: item.children,
                key: item.key,
                label: item.label,
              }))}
              onChange={(key) => {
                setSelectedTabKey(key);
                setTabGlowClassName((currentClassName) =>
                  getRandomTabGlowClass(currentClassName),
                );
              }}
            />
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
