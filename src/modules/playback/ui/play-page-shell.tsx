"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import type Artplayer from "artplayer";
import type { Danmu, Option as DanmakuOption, Result as DanmakuPluginResult } from "artplayer-plugin-danmuku";
import Image from "next/image";
import { Badge, Button, Chip, Separator, Tabs } from "@heroui/react";
import { env } from "@/shared/env";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { Episode, PlayPageData } from "../domain/playback-page-data";

const episodeGroupSize = 50;
const playbackDurationSeconds = 45 * 60 + 8;
const initialPlayerVolume: number = 72;
const tabBaseClassName =
  "group relative h-[72px] justify-center rounded-none text-sm font-medium transition-colors before:absolute before:inset-x-6 before:top-1/2 before:h-[72px] before:-translate-y-1/2 before:opacity-0 before:transition-opacity data-[selected]:text-accent data-[selected]:before:opacity-100";

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
  quality?: string;
  source_name: string;
  total_episodes: number;
};
type PlaybackSourceSseEvent =
  | { event: "start"; data: { total: number } }
  | { event: "result"; data: PlaybackSourceOption }
  | { event: "complete"; data: { completed: number; total: number } }
  | { event: "error"; data: { message?: string } };

function getRandomTabGlowClass(currentClassName: TabGlowClassName): TabGlowClassName {
  const nextClassNames = tabGlowClassNames.filter((className) => className !== currentClassName);
  const candidates = nextClassNames.length > 0 ? nextClassNames : tabGlowClassNames;

  return candidates[Math.floor(Math.random() * candidates.length)] ?? tabGlowClassNames[0];
}

function getEpisodeDanmuku(episodeNumber: number): Danmu[] {
  const episodeOffset = episodeNumber % 7;

  return [
    { text: "这段转场很顺", time: 8 + episodeOffset, mode: 0, color: "#FFFFFF" },
    { text: "前方高能", time: 18 + episodeOffset, mode: 0, color: "#89D5FF" },
    { text: "画面质感不错", time: 32 + episodeOffset, mode: 1, color: "#FFD302" },
    { text: "这一集节奏起来了", time: 46 + episodeOffset, mode: 0, color: "#A0EE00" },
    { text: "字幕同步正常", time: 72 + episodeOffset, mode: 2, color: "#FFFFFF" },
    { text: "建议开启倍速", time: 105 + episodeOffset, mode: 0, color: "#FFAA02" },
  ];
}

function getArtplayerDanmakuPlugin(art: Artplayer): DanmakuPluginResult | undefined {
  return art.plugins.artplayerPluginDanmuku as DanmakuPluginResult | undefined;
}

function getEpisodeGroups(episodes: Episode[]) {
  return Array.from({ length: Math.ceil(episodes.length / episodeGroupSize) }, (_, index) => {
    const start = index * episodeGroupSize;
    const groupEpisodes = episodes.slice(start, start + episodeGroupSize);

    return {
      key: `${groupEpisodes[0]?.number ?? start}-${groupEpisodes.at(-1)?.number ?? start}`,
      label: `${groupEpisodes[0]?.number ?? start}-${groupEpisodes.at(-1)?.number ?? start}`,
      episodes: groupEpisodes,
    };
  });
}

function getEpisodeGroupKeyForEpisode(episodes: Episode[], episodeNumber: number) {
  const group = getEpisodeGroups(episodes).find((currentGroup) =>
    currentGroup.episodes.some((episode) => episode.number === episodeNumber),
  );

  return group?.key ?? getEpisodeGroups(episodes)[0]?.key ?? "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeResumeTime(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
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

function parsePlaybackSourceSseBlock(block: string): PlaybackSourceSseEvent | null {
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

    if (event === "start" || event === "result" || event === "complete" || event === "error") {
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

export function PlayPageShell({
  initialData,
  playbackPlaceholderError,
}: {
  initialData?: PlayPageData;
  playbackPlaceholderError?: string;
} = {}) {
  const [playbackData, setPlaybackData] = useState<PlayPageData | null>(initialData ?? null);
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
  const hasPlaybackPlaceholderError = Boolean(playbackPlaceholderError) || !playbackData;
  const artContainerRef = useRef<HTMLDivElement>(null);
  const artPlayerRef = useRef<Artplayer | null>(null);
  const hasAppliedResumeTimeRef = useRef(false);
  const hasPlaybackStartedRef = useRef(false);
  const initialResumeTimeSeconds = normalizeResumeTime(playbackData?.play_time);
  const [activeEpisode, setActiveEpisode] = useState(playbackData?.play_episodes ?? 1);
  const [activeSource, setActiveSource] = useState(
    playbackData?.sources[(playbackData?.play_episodes ?? 1) - 1]?.id ?? playbackData?.sources[0]?.id ?? "",
  );
  const [selectedGroupKey, setSelectedGroupKey] = useState(() =>
    playbackData ? getEpisodeGroupKeyForEpisode(playbackData.episodes, playbackData.play_episodes) : "",
  );
  const [selectedTabKey, setSelectedTabKey] = useState("episodes");
  const [tabGlowClassName, setTabGlowClassName] = useState<TabGlowClassName>(tabGlowClassNames[0]);
  const [isDescending, setIsDescending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(initialPlayerVolume);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(Boolean(playbackData?.is_favorite));
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [playbackSourceOptions, setPlaybackSourceOptions] = useState<PlaybackSourceOption[]>([]);
  const [isSourceSwitching, setIsSourceSwitching] = useState(false);
  const activeEpisodeRef = useRef(activeEpisode);
  const isPlayingRef = useRef(isPlaying);
  const shouldResumePlaybackRef = useRef(false);
  const currentPlaybackSecondsRef = useRef(initialResumeTimeSeconds);
  const currentPlaybackDurationRef = useRef(playbackDurationSeconds);
  const initialDanmakuOptionRef = useRef<DanmakuOption>({
    danmuku: getEpisodeDanmuku(playbackData?.play_episodes ?? 1),
    speed: 5,
    margin: [10, 10],
    opacity: 0.85,
    color: "#FFFFFF",
    mode: 0,
    modes: [0, 1, 2],
    fontSize: 36,
    antiOverlap: true,
    synchronousPlayback: true,
    visible: true,
    emitter: false,
  });

  const episodeGroups = useMemo(() => (playbackData ? getEpisodeGroups(playbackData.episodes) : []), [playbackData]);
  const selectedGroup = episodeGroups.find((group) => group.key === selectedGroupKey) ?? episodeGroups[0];
  const visibleEpisodes = selectedGroup ? (isDescending ? [...selectedGroup.episodes].reverse() : selectedGroup.episodes) : [];
  const currentSource =
    playbackData?.sources.find((source) => source.id === activeSource) ?? playbackData?.sources[0];
  const currentSourceName = playbackData?.source_name.trim() || currentSource?.name.trim() || "";
  const currentPlaybackUrl =
    currentSource?.url ??
    playbackData?.sources[activeEpisode - 1]?.url ??
    playbackData?.sources[0]?.url ??
    "";
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
  const setPlaybackPosterVisible = useCallback((art: Artplayer, visible: boolean) => {
    const posterElement = artContainerRef.current?.querySelector(".art-poster") as HTMLDivElement | null;

    if (posterElement) {
      posterElement.style.display = visible ? "" : "none";
    }
  }, []);
  const uploadPlaybackProgress = useCallback(() => {
    const art = artPlayerRef.current;

    if (!progressEndpoint || hasPlaybackPlaceholderError || !art || !playbackData) {
      return;
    }

    const playTime = Math.floor(Math.max(0, art.currentTime || currentPlaybackSecondsRef.current));
    const totalTime = Math.floor(Math.max(0, art.duration || currentPlaybackDurationRef.current));

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

    void fetch(`/api/play/sources?index=${encodeURIComponent(playbackData.index)}`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = readPlaybackSourceSseEvents(buffer);
          buffer = parsed.remaining;

          for (const event of parsed.events) {
            if (event.event !== "result") {
              continue;
            }

            seen.set(`${event.data.key}:${event.data.id}`, event.data);
          }

          setPlaybackSourceOptions(Array.from(seen.values()));
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [playbackData?.index]);
  const switchPlaybackSource = useCallback(
    async (source: PlaybackSourceOption) => {
      if (!playbackData || isSourceSwitching) {
        return;
      }

      const currentTime = Math.floor(Math.max(0, currentPlaybackSecondsRef.current));
      const totalTime = Math.floor(Math.max(0, currentPlaybackDurationRef.current));

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
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          setPlaybackError(data?.message ?? "切换源失败，请稍后重试。");
          return;
        }

        const data = (await response.json()) as PlaybackSourceSwitchResponse;
        const nextPlayEpisodes = data.progress.play_episodes;
        const nextSourceId = data.sources[nextPlayEpisodes - 1]?.id ?? data.sources[0]?.id ?? "";
        const nextUrl = `/play?source=${encodeURIComponent(data.progress.source)}&id=${encodeURIComponent(data.progress.id)}`;

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
        setSelectedGroupKey(getEpisodeGroupKeyForEpisode(data.episodes, nextPlayEpisodes));
        currentPlaybackSecondsRef.current = data.progress.play_time;
        currentPlaybackDurationRef.current = totalTime;
        hasAppliedResumeTimeRef.current = false;
        hasPlaybackStartedRef.current = false;

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", nextUrl);
        }
      } catch {
        setPlaybackError("切换源失败，请稍后重试。");
      } finally {
        setIsSourceSwitching(false);
      }
    },
    [isSourceSwitching, playbackData],
  );
  const resetPlaybackForEpisode = useCallback((episodeNumber: number) => {
    const art = artPlayerRef.current;

    if (!playbackData) {
      return;
    }

    shouldResumePlaybackRef.current = isPlayingRef.current;
    hasPlaybackStartedRef.current = false;

    setActiveEpisode(episodeNumber);
    setSelectedGroupKey(getEpisodeGroupKeyForEpisode(playbackData.episodes, episodeNumber));
    setActiveSource(playbackData.sources[episodeNumber - 1]?.id ?? playbackData.sources[0]?.id ?? "");
    currentPlaybackSecondsRef.current = 0;
    setPlaybackError(null);
    setIsPlaying(false);

    if (art) {
      art.pause();
      art.currentTime = 0;
      art.poster = playbackCoverDefaultUrl;
      setPlaybackPosterVisible(art, true);
    }
  }, [playbackData, playbackCoverDefaultUrl, setPlaybackPosterVisible]);
  const playNextEpisode = useCallback(() => {
    if (!playbackData) {
      return;
    }

    const currentIndex = playbackData.episodes.findIndex((episode) => episode.number === activeEpisode);
    const nextEpisode = playbackData.episodes[currentIndex + 1];

    if (!nextEpisode) {
      return;
    }

    resetPlaybackForEpisode(nextEpisode.number);
  }, [activeEpisode, playbackData, resetPlaybackForEpisode]);
  const skipPlayback = useCallback((seconds: number) => {
    const art = artPlayerRef.current;
    const maxSeconds = currentPlaybackDurationRef.current > 0 ? currentPlaybackDurationRef.current : playbackDurationSeconds;

    if (!art) {
      currentPlaybackSecondsRef.current = clamp(currentPlaybackSecondsRef.current + seconds, 0, maxSeconds);
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
  const capturePlaybackCover = useCallback((art: Artplayer) => {
    if (hasPlaybackStartedRef.current) {
      return;
    }

    const video = art.video;

    if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
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
  }, [playbackCoverDefaultUrl, setPlaybackPosterVisible]);

  useEffect(() => {
    const container = artContainerRef.current;

    if (hasPlaybackPlaceholderError || !container || !playbackData) {
      return;
    }

    let isMounted = true;
    setPlaybackError(null);

    void Promise.all([import("artplayer"), import("artplayer-plugin-danmuku")]).then(
      ([{ default: ArtplayerConstructor }, { default: artplayerPluginDanmuku }]) => {
        if (!isMounted || !artContainerRef.current) {
          return;
        }

        const art = new ArtplayerConstructor({
          container: artContainerRef.current,
          url: currentPlaybackUrl,
          type: "m3u8",
          poster: playbackCoverDefaultUrl,
          volume: initialPlayerVolume / 100,
          muted: initialPlayerVolume === 0,
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
          plugins: [artplayerPluginDanmuku(initialDanmakuOptionRef.current)],
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
        art.volume = initialPlayerVolume / 100;
        art.muted = initialPlayerVolume === 0;
        art.controls.add({
          name: "mixtv-skip-backward",
          html: '<i class="bi bi-skip-backward-fill"></i>',
          position: "left",
          index: 11,
          tooltip: "快退 10 秒",
          click: () => playbackActionsRef.current.skipPlayback(-10),
        });
        art.controls.add({
          name: "mixtv-skip-forward",
          html: '<i class="bi bi-skip-forward-fill"></i>',
          position: "left",
          index: 12,
          tooltip: "快进 10 秒",
          click: () => playbackActionsRef.current.skipPlayback(10),
        });
        art.controls.add({
          name: "mixtv-next-episode",
          html: '<i class="bi bi-skip-end-fill"></i>',
          position: "left",
          index: 13,
          tooltip: "下一集",
          click: () => playbackActionsRef.current.playNextEpisode(),
        });
        art.on("video:loadedmetadata", () => {
          if (Number.isFinite(art.duration) && art.duration > 0) {
            currentPlaybackDurationRef.current = art.duration;
          }
          if (!hasAppliedResumeTimeRef.current && initialResumeTimeSeconds > 0) {
            const nextTime = Number.isFinite(art.duration) && art.duration > 0
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
        });
        art.on("error", () => {
          setPlaybackError("视频加载失败，请稍后重试或切换线路。");
        });

        if (shouldResumePlaybackRef.current || isPlayingRef.current) {
          shouldResumePlaybackRef.current = false;
          void art.play();
        }
      });

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
    if (!artPlayerRef.current) {
      return;
    }

    artPlayerRef.current.volume = volume / 100;
    artPlayerRef.current.muted = volume === 0;
  }, [volume]);

  useEffect(() => {
    const art = artPlayerRef.current;
    const danmakuPlugin = art ? getArtplayerDanmakuPlugin(art) : undefined;

    if (!danmakuPlugin) {
      return;
    }

    void danmakuPlugin.load(getEpisodeDanmuku(activeEpisode));
  }, [activeEpisode]);

  const toggleFavorite = useCallback(async () => {
    if (isFavoritePending) {
      return;
    }

    setIsFavoritePending(true);

    try {
      if (!playbackData) {
        return;
      }

      const response = await fetch(`/api/favorites/${encodeURIComponent(playbackData.progress_source)}/${encodeURIComponent(playbackData.progress_id)}`, {
        headers: { Accept: "application/json" },
        method: isFavorite ? "DELETE" : "POST",
      });

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

  if (hasPlaybackPlaceholderError || !playbackData) {
    return (
      <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[100rem] gap-5">
          <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-default-200/70 bg-surface px-6 text-center shadow-sm">
            <div className="grid max-w-md justify-items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-white/12 bg-white/8 text-2xl text-danger-300">
                <i aria-hidden="true" className="bi bi-exclamation-triangle" />
              </span>
              <h1 className="text-lg font-semibold tracking-normal">播放信息不可用</h1>
              <p className="text-sm leading-6 text-default-500">{placeholderMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[100rem] gap-5">
        <nav aria-label="播放导航" className="flex min-w-0 items-center gap-2 text-sm text-default-500">
          <span className="truncate font-medium text-default-600 transition-colors hover:text-accent">
            {playbackData.title}
          </span>
          <i aria-hidden="true" className="bi bi-chevron-right text-xs" />
          <span className="truncate text-foreground">第 {activeEpisode} 集</span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className={`relative aspect-video min-h-[260px] overflow-hidden bg-zinc-950 md:min-h-[520px] ${isWebFullscreen
              ? "fixed inset-x-0 top-16 z-50 aspect-auto h-[calc(100dvh-4rem)] min-h-0"
              : ""}`}
          >
            <div
              ref={artContainerRef}
              aria-label={`${playbackData.title} 第 ${activeEpisode} 集视频`}
              data-mixtv-artplayer
              className="absolute inset-0 z-20 h-full w-full bg-black [&_.art-video-player]:h-full [&_.art-video-player]:w-full"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_56%,rgba(0,0,0,0.32)_100%)]" />
          </div>
          {playbackError ? <p className="px-1 text-sm text-danger-300">{playbackError}</p> : null}

          <div className="overflow-hidden rounded-xl border border-default-200/70 bg-surface shadow-sm backdrop-blur">
            <Tabs
              className="w-full [&_.tabs__indicator]:hidden"
              selectedKey={selectedTabKey}
              variant="secondary"
              onSelectionChange={(key) => {
                setSelectedTabKey(String(key));
                setTabGlowClassName((currentClassName) => getRandomTabGlowClass(currentClassName));
              }}
            >
              <Tabs.ListContainer className="bg-surface p-0">
                <Tabs.List aria-label="播放控制" className="grid w-full grid-cols-2 gap-0 border-b-0 bg-transparent">
                  <Tabs.Tab id="episodes" className={`${tabBaseClassName} ${tabGlowClassName}`}>
                    <span className="relative inline-flex items-center gap-2 rounded-md px-5 py-2.5 transition-colors">
                      <i aria-hidden="true" className="bi bi-collection-play" />
                      选集
                    </span>
                  </Tabs.Tab>
                  <Tabs.Tab id="sources" className={`${tabBaseClassName} ${tabGlowClassName}`}>
                    <span className="relative inline-flex items-center gap-2 rounded-md px-5 py-2.5 transition-colors">
                      <i aria-hidden="true" className="bi bi-broadcast" />
                      换源
                    </span>
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>

              <Separator />

              <Tabs.Panel id="episodes">
                <div className="grid gap-4 p-4 md:p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
                    <div className="scrollbar-hide flex min-w-0 gap-2 overflow-x-auto">
                      {episodeGroups.map((group) => (
                        <Button
                          key={group.key}
                          className="shrink-0"
                          size="sm"
                          variant={group.key === selectedGroupKey ? "primary" : "outline"}
                          onPress={() => setSelectedGroupKey(group.key)}
                        >
                          {group.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      aria-label={isDescending ? "切换为正序" : "切换为倒序"}
                      className="h-8 w-8 min-w-0 p-0"
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => setIsDescending((value) => !value)}
                    >
                      <i aria-hidden="true" className={`bi ${isDescending ? "bi-sort-numeric-down-alt" : "bi-sort-numeric-down"}`} />
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid max-h-[430px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 xl:grid-cols-5">
                    {visibleEpisodes.map((episode) => (
                      <button
                        key={episode.number}
                        type="button"
                        aria-label={`${episode.title} ${episode.duration}`}
                        className={`h-7 min-w-[3.5rem] cursor-pointer rounded px-3 text-sm font-medium transition-colors ${episode.number === activeEpisode
                          ? "bg-accent text-accent-foreground"
                          : "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_12%,transparent),color-mix(in_srgb,var(--surface-secondary)_82%,transparent))] text-default-700 ring-1 ring-inset ring-white/35 hover:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,transparent),color-mix(in_srgb,var(--surface-secondary)_92%,transparent))] hover:text-foreground"
                          }`}
                        onClick={() => resetPlaybackForEpisode(episode.number)}
                      >
                        {episode.number}
                      </button>
                    ))}
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel id="sources">
                <div className="grid max-h-[490px] gap-3 overflow-y-auto p-4 pr-3 md:p-5 md:pr-4">
                  {playbackSourceOptions.length > 0 ? (
                    <>
                      {playbackSourceOptions.map((source) => {
                        const isCurrentSource =
                          source.key === playbackData.progress_source && source.id === playbackData.progress_id;

                        return (
                          <button
                            type="button"
                            key={`${source.key}:${source.id}`}
                            className={`relative grid cursor-pointer gap-3 rounded-lg border p-4 text-left transition-colors ${isCurrentSource
                              ? "border-accent bg-white/2"
                              : "border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-white/12 hover:border-[color-mix(in_srgb,var(--accent)_38%,transparent)] hover:bg-white/16"
                              }`}
                            disabled={isSourceSwitching}
                            onClick={() => switchPlaybackSource(source)}
                          >
                            {isCurrentSource ? (
                              <Badge
                                className="px-2.5 text-white"
                                color="success"
                                placement="top-right"
                                size="md"
                                variant="primary"
                              >
                                当前源
                              </Badge>
                            ) : null}
                            <span className="flex min-w-0 items-center gap-3 pr-16">
                              <span className="min-w-0 truncate font-medium text-foreground">{source.name}</span>
                            </span>
                            <span className="flex flex-wrap items-center justify-between gap-3 text-xs text-default-500">
                              <span className="flex min-w-0 flex-wrap items-center gap-2">
                                {source.quality ? (
                                  <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                                    {source.quality}
                                  </Chip>
                                ) : null}
                              </span>
                              <Chip className="h-5 shrink-0 px-1 text-[11px]" color="default" size="sm" variant="soft">
                                {source.total_episodes} 集
                              </Chip>
                            </span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    playbackData.sources.map((source, index) => (
                      <button
                        key={source.id}
                        type="button"
                        className={`relative grid cursor-pointer gap-3 rounded-lg border p-4 text-left transition-colors ${source.id === activeSource
                          ? "border-accent bg-white/2"
                          : "border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-white/12 hover:border-[color-mix(in_srgb,var(--accent)_38%,transparent)] hover:bg-white/16"
                          }`}
                        onClick={() => resetPlaybackForEpisode(index + 1)}
                      >
                        {source.id === activeSource ? (
                          <Badge
                            className="px-2.5 text-white"
                            color="success"
                            placement="top-right"
                            size="md"
                            variant="primary"
                          >
                            当前源
                          </Badge>
                        ) : null}
                        <span className="flex min-w-0 items-center gap-3 pr-16">
                          <span className="min-w-0 truncate font-medium text-foreground">{source.name}</span>
                        </span>
                        <span className="flex items-center justify-between gap-3 text-xs text-default-500">
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                              {source.quality}
                            </Chip>
                            <span>{source.latency}</span>
                          </span>
                          <Chip className="h-5 shrink-0 px-1 text-[11px]" color="default" size="sm" variant="soft">
                            {playbackData.episodes.length} 集
                          </Chip>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl bg-[var(--surface)] p-4 shadow-sm backdrop-blur md:grid-cols-[180px_minmax(0,1fr)] md:p-5">
          <div className="relative aspect-[2/3] w-36 overflow-hidden rounded-lg bg-default-100 md:w-full">
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
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{playbackData.title}</h2>
              </div>
              <Button
                aria-pressed={isFavorite}
                isDisabled={isFavoritePending}
                size="sm"
                variant={isFavorite ? "primary" : "outline"}
                onPress={toggleFavorite}
              >
                <i aria-hidden="true" className={`bi ${isFavorite ? "bi-heart-fill" : "bi-heart"}`} />
                {isFavorite ? "已收藏" : "收藏"}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {currentSourceName ? (
                <Chip
                  className="rounded-full bg-accent/14 px-3 text-sm font-semibold text-accent ring-1 ring-accent/25 shadow-sm"
                  color="accent"
                  variant="soft"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <i aria-hidden="true" className="bi bi-broadcast" />
                    {currentSourceName}
                  </span>
                </Chip>
              ) : null}
              {playbackData.tags.map((tag) => (
                <Chip key={tag} className="rounded-full px-2.5 text-[11px]" color="accent" variant="soft">
                  {tag}
                </Chip>
              ))}
            </div>

            <Separator className="my-5" />

            <p className="mt-5 text-sm leading-7 text-default-600">{playbackData.description}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
