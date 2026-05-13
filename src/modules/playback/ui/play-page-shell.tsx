"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import type Artplayer from "artplayer";
import type { Danmu, Mode as DanmakuMode, Option as DanmakuOption, Result as DanmakuPluginResult } from "artplayer-plugin-danmuku";
import Image from "next/image";
import { Badge, Button, Chip, Popover, Separator, Switch, Tabs } from "@heroui/react";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";

type Episode = {
  number: number;
  title: string;
  duration: string;
};

type VideoSource = {
  id: string;
  name: string;
  url: string;
  quality: string;
  latency: string;
  status: "流畅" | "拥挤" | "维护";
};

type PlayPageData = {
  title: string;
  originalTitle: string;
  currentEpisode: number;
  posterUrl: string;
  year: string;
  area: string;
  category: string;
  rating: string;
  sourceName: string;
  description: string;
  tags: string[];
  episodes: Episode[];
  sources: VideoSource[];
};

const episodeGroupSize = 50;
const playbackSourceUrl = "https://cdn.ryplay12.com/20260506/35803_75083138/index.m3u8";
const playbackDurationSeconds = 45 * 60 + 8;
const initialPlayerVolume: number = 72;
const initialPlaybackRate: number = 1;
const playerControlButtonClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg text-white/50 transition-colors hover:cursor-pointer hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";
const danmakuDisplayAreas = [
  { label: "1/4", value: "quarter" },
  { label: "半屏", value: "half" },
  { label: "3/4", value: "three-quarter" },
  { label: "满屏", value: "full" },
] as const;
const danmakuSpeedOptions = [
  { label: "极慢", value: "very-slow" },
  { label: "较慢", value: "slow" },
  { label: "适中", value: "normal" },
  { label: "较快", value: "fast" },
  { label: "极快", value: "very-fast" },
] as const;

const tabBaseClassName =
  "group relative h-[72px] justify-center rounded-none text-sm font-medium transition-colors before:absolute before:inset-x-6 before:top-1/2 before:h-[72px] before:-translate-y-1/2 before:opacity-0 before:transition-opacity data-[selected]:text-accent data-[selected]:before:opacity-100";

const tabGlowClassNames = [
  "before:bg-[radial-gradient(circle_at_42%_42%,color-mix(in_srgb,var(--accent)_13%,transparent)_0%,transparent_36%),radial-gradient(circle_at_62%_58%,color-mix(in_srgb,var(--accent)_9%,transparent)_0%,transparent_34%),radial-gradient(ellipse_64%_42%_at_52%_50%,color-mix(in_srgb,var(--accent)_6%,transparent)_0%,transparent_72%)]",
  "before:bg-[radial-gradient(circle_at_36%_56%,color-mix(in_srgb,var(--accent)_12%,transparent)_0%,transparent_32%),radial-gradient(circle_at_58%_38%,color-mix(in_srgb,var(--accent)_9%,transparent)_0%,transparent_38%),radial-gradient(ellipse_70%_46%_at_50%_52%,color-mix(in_srgb,var(--accent)_5%,transparent)_0%,transparent_74%)]",
  "before:bg-[radial-gradient(circle_at_46%_34%,color-mix(in_srgb,var(--accent)_11%,transparent)_0%,transparent_34%),radial-gradient(circle_at_66%_54%,color-mix(in_srgb,var(--accent)_8%,transparent)_0%,transparent_36%),radial-gradient(ellipse_58%_52%_at_48%_54%,color-mix(in_srgb,var(--accent)_6%,transparent)_0%,transparent_76%)]",
  "before:bg-[radial-gradient(circle_at_34%_44%,color-mix(in_srgb,var(--accent)_10%,transparent)_0%,transparent_30%),radial-gradient(circle_at_54%_64%,color-mix(in_srgb,var(--accent)_11%,transparent)_0%,transparent_35%),radial-gradient(ellipse_68%_40%_at_55%_48%,color-mix(in_srgb,var(--accent)_5%,transparent)_0%,transparent_72%)]",
] as const;

type TabGlowClassName = (typeof tabGlowClassNames)[number];
type DanmakuDisplayArea = (typeof danmakuDisplayAreas)[number]["value"];
type DanmakuSpeed = (typeof danmakuSpeedOptions)[number]["value"];
type ArtplayerWithHls = Artplayer & { hls?: Hls };

function getRandomTabGlowClass(currentClassName: TabGlowClassName): TabGlowClassName {
  const nextClassNames = tabGlowClassNames.filter((className) => className !== currentClassName);
  const candidates = nextClassNames.length > 0 ? nextClassNames : tabGlowClassNames;

  return candidates[Math.floor(Math.random() * candidates.length)] ?? tabGlowClassNames[0];
}

const playPageData: PlayPageData = {
  title: "星河漫游",
  originalTitle: "Stellar Roaming",
  currentEpisode: 18,
  posterUrl: createPlaceholderImageUrl({
    variant: "poster",
    fileStem: "星河漫游",
    seed: "playback-stellar-roaming",
  }),
  year: "2026",
  area: "中国大陆",
  category: "科幻 / 冒险 / 剧情",
  rating: "8.7",
  sourceName: "高清源 1",
  description:
    "一支年轻的深空补给队在边境星域发现异常信号，原本例行的护航任务逐渐牵出旧时代航道、失落殖民地与联盟内部的秘密。",
  tags: ["更新至 120 集", "每周二更新", "支持多线路", "中文字幕"],
  episodes: Array.from({ length: 120 }, (_, index) => {
    const number = index + 1;

    return {
      number,
      title: `第 ${number} 集`,
      duration: number % 6 === 0 ? "49 分钟" : "45 分钟",
    };
  }),
  sources: [
    { id: "source-hd-1", name: "高清源 1", url: playbackSourceUrl, quality: "1080P", latency: "低延迟", status: "流畅" },
    { id: "source-hd-2", name: "备用源 2", url: playbackSourceUrl, quality: "1080P", latency: "普通", status: "流畅" },
    { id: "source-uhd", name: "超清源", url: playbackSourceUrl, quality: "4K", latency: "普通", status: "拥挤" },
    { id: "source-mobile", name: "移动源", url: playbackSourceUrl, quality: "720P", latency: "低流量", status: "流畅" },
  ],
};

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

function getDanmakuDisplayAreaMargin(area: DanmakuDisplayArea): DanmakuOption["margin"] {
  if (area === "quarter") {
    return [10, "75%"];
  }
  if (area === "half") {
    return [10, "50%"];
  }
  if (area === "three-quarter") {
    return [10, "25%"];
  }

  return [10, 10];
}

function getDanmakuSpeedValue(speed: DanmakuSpeed) {
  const speedMap: Record<DanmakuSpeed, number> = {
    "very-slow": 10,
    slow: 7.5,
    normal: 5,
    fast: 2.5,
    "very-fast": 1,
  };

  return speedMap[speed];
}

function getDanmakuVisibleModes({
  isRollingBlocked,
  isTopBlocked,
  isBottomBlocked,
}: {
  isRollingBlocked: boolean;
  isTopBlocked: boolean;
  isBottomBlocked: boolean;
}): DanmakuMode[] {
  const modes: DanmakuMode[] = [];

  if (!isRollingBlocked) {
    modes.push(0);
  }
  if (!isTopBlocked) {
    modes.push(1);
  }
  if (!isBottomBlocked) {
    modes.push(2);
  }

  return modes;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPlaybackTime(seconds: number, maxSeconds = playbackDurationSeconds) {
  const safeSeconds = Math.floor(clamp(seconds, 0, maxSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function PlayPageShell() {
  const playerRef = useRef<HTMLDivElement>(null);
  const artContainerRef = useRef<HTMLDivElement>(null);
  const artPlayerRef = useRef<Artplayer | null>(null);
  const controlBarContentRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const volumeHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlBarHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeEpisode, setActiveEpisode] = useState(playPageData.currentEpisode);
  const [activeSource, setActiveSource] = useState(playPageData.sources[0].id);
  const [selectedGroupKey, setSelectedGroupKey] = useState("1-50");
  const [selectedTabKey, setSelectedTabKey] = useState("episodes");
  const [tabGlowClassName, setTabGlowClassName] = useState<TabGlowClassName>(tabGlowClassNames[0]);
  const [isDescending, setIsDescending] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackSeconds, setCurrentPlaybackSeconds] = useState(0);
  const [currentPlaybackDuration, setCurrentPlaybackDuration] = useState(playbackDurationSeconds);
  const [volume, setVolume] = useState(initialPlayerVolume);
  const [activePlayerPanel, setActivePlayerPanel] = useState<"volume" | "danmaku" | "settings" | null>(null);
  const [isDanmakuEnabled, setIsDanmakuEnabled] = useState(true);
  const [isRollingDanmakuBlocked, setIsRollingDanmakuBlocked] = useState(false);
  const [isTopDanmakuBlocked, setIsTopDanmakuBlocked] = useState(false);
  const [isBottomDanmakuBlocked, setIsBottomDanmakuBlocked] = useState(false);
  const [isDanmakuOverlapPrevented, setIsDanmakuOverlapPrevented] = useState(true);
  const [isDanmakuSpeedSynced, setIsDanmakuSpeedSynced] = useState(true);
  const [danmakuOpacity, setDanmakuOpacity] = useState(80);
  const [danmakuDisplayArea, setDanmakuDisplayArea] = useState<DanmakuDisplayArea>("full");
  const [danmakuFontSize, setDanmakuFontSize] = useState(25);
  const [danmakuSpeed, setDanmakuSpeed] = useState<DanmakuSpeed>("normal");
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isControlBarVisible, setIsControlBarVisible] = useState(true);
  const [isVolumePanelHovered, setIsVolumePanelHovered] = useState(false);
  const [volumePanelLeft, setVolumePanelLeft] = useState<number | null>(null);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const episodeGroups = useMemo(() => getEpisodeGroups(playPageData.episodes), []);
  const selectedGroup = episodeGroups.find((group) => group.key === selectedGroupKey) ?? episodeGroups[0];
  const visibleEpisodes = isDescending ? [...selectedGroup.episodes].reverse() : selectedGroup.episodes;
  const currentSource = playPageData.sources.find((source) => source.id === activeSource) ?? playPageData.sources[0];
  const usablePlaybackDuration =
    Number.isFinite(currentPlaybackDuration) && currentPlaybackDuration > 0 ? currentPlaybackDuration : playbackDurationSeconds;
  const currentPlaybackTime = formatPlaybackTime(currentPlaybackSeconds, usablePlaybackDuration);
  const totalPlaybackTime = formatPlaybackTime(usablePlaybackDuration, usablePlaybackDuration);
  const volumeIconClassName =
    volume === 0 ? "bi-volume-mute-fill" : volume < 45 ? "bi-volume-down-fill" : "bi-volume-up-fill";
  const isVolumePanelVisible = activePlayerPanel === "volume" || isVolumePanelHovered;
  const selectedDanmakuDisplayAreaLabel =
    danmakuDisplayAreas.find((area) => area.value === danmakuDisplayArea)?.label ?? danmakuDisplayAreas[0].label;
  const selectedDanmakuSpeedLabel =
    danmakuSpeedOptions.find((speed) => speed.value === danmakuSpeed)?.label ?? danmakuSpeedOptions[2].label;
  const shouldShowPlaybackOverlay = !isPlaying && (isPlaybackReady || playbackError);
  const danmakuOption = useMemo<DanmakuOption>(() => ({
    danmuku: getEpisodeDanmuku(activeEpisode),
    visible: isDanmakuEnabled,
    emitter: false,
    opacity: danmakuOpacity / 100,
    margin: getDanmakuDisplayAreaMargin(danmakuDisplayArea),
    fontSize: danmakuFontSize,
    speed: getDanmakuSpeedValue(danmakuSpeed),
    antiOverlap: isDanmakuOverlapPrevented,
    synchronousPlayback: isDanmakuSpeedSynced,
    modes: getDanmakuVisibleModes({
      isRollingBlocked: isRollingDanmakuBlocked,
      isTopBlocked: isTopDanmakuBlocked,
      isBottomBlocked: isBottomDanmakuBlocked,
    }),
  }), [
    activeEpisode,
    danmakuDisplayArea,
    danmakuFontSize,
    danmakuOpacity,
    danmakuSpeed,
    isBottomDanmakuBlocked,
    isDanmakuEnabled,
    isDanmakuOverlapPrevented,
    isDanmakuSpeedSynced,
    isRollingDanmakuBlocked,
    isTopDanmakuBlocked,
  ]);
  const initialPlaybackUrlRef = useRef(currentSource.url);
  const initialDanmakuOptionRef = useRef(danmakuOption);

  useEffect(() => {
    const container = artContainerRef.current;

    if (!container) {
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
        url: initialPlaybackUrlRef.current,
        type: "m3u8",
        poster: playPageData.posterUrl,
        volume: initialPlayerVolume / 100,
        muted: initialPlayerVolume === 0,
        playbackRate: true,
        setting: false,
        hotkey: true,
        fullscreen: false,
        fullscreenWeb: false,
        miniProgressBar: false,
        playsInline: true,
        moreVideoAttr: {
          crossOrigin: "anonymous",
          preload: "metadata",
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

                  setIsPlaybackReady(false);
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
      art.playbackRate = initialPlaybackRate;
      art.volume = initialPlayerVolume / 100;
      art.muted = initialPlayerVolume === 0;

      art.on("video:loadedmetadata", () => {
        if (Number.isFinite(art.duration) && art.duration > 0) {
          setCurrentPlaybackDuration(art.duration);
        }
        setIsPlaybackReady(true);
      });
      art.on("video:durationchange", () => {
        if (Number.isFinite(art.duration) && art.duration > 0) {
          setCurrentPlaybackDuration(art.duration);
        }
      });
      art.on("video:timeupdate", () => setCurrentPlaybackSeconds(art.currentTime));
      art.on("video:play", () => {
        setPlaybackError(null);
        setIsPlaybackReady(true);
        setIsControlBarVisible(true);
        setIsPlaying(true);
      });
      art.on("video:pause", () => {
        setIsControlBarVisible(true);
        setIsPlaying(false);
      });
      art.on("video:waiting", () => setIsPlaybackReady(false));
      art.on("video:stalled", () => setIsPlaybackReady(false));
      art.on("video:canplay", () => setIsPlaybackReady(true));
      art.on("video:canplaythrough", () => setIsPlaybackReady(true));
      art.on("video:ended", () => {
        setActiveEpisode((currentEpisode) => (currentEpisode >= playPageData.episodes.length ? 1 : currentEpisode + 1));
        setCurrentPlaybackSeconds(0);
        setIsControlBarVisible(true);
        setIsPlaying(false);
      });
      art.on("fullscreenWeb", (state) => setIsWebFullscreen(state));
      art.on("error", () => {
        setIsPlaybackReady(false);
        setPlaybackError("视频加载失败，请稍后重试或切换线路。");
      });
    });

    return () => {
      isMounted = false;
      artPlayerRef.current?.destroy(false);
      artPlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!artPlayerRef.current) {
      return;
    }

    artPlayerRef.current.volume = volume / 100;
    artPlayerRef.current.muted = volume === 0;
  }, [volume]);

  useEffect(() => {
    if (!artPlayerRef.current) {
      return;
    }

    artPlayerRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const art = artPlayerRef.current;

    if (!art || art.url === currentSource.url) {
      return;
    }

    setCurrentPlaybackSeconds(0);
    setIsPlaybackReady(false);
    setPlaybackError(null);

    void art.switchUrl(currentSource.url).catch(() => {
      setIsPlaybackReady(false);
      setPlaybackError("切换线路失败，请稍后重试。");
    });
  }, [currentSource.url]);

  useEffect(() => {
    const danmakuPlugin = artPlayerRef.current ? getArtplayerDanmakuPlugin(artPlayerRef.current) : undefined;

    danmakuPlugin?.config(danmakuOption);
  }, [danmakuOption]);

  useEffect(() => {
    const danmakuPlugin = artPlayerRef.current ? getArtplayerDanmakuPlugin(artPlayerRef.current) : undefined;

    void danmakuPlugin?.load(getEpisodeDanmuku(activeEpisode));
  }, [activeEpisode]);

  useEffect(() => {
    return () => {
      if (volumeHoverTimeoutRef.current) {
        clearTimeout(volumeHoverTimeoutRef.current);
      }
      if (controlBarHideTimeoutRef.current) {
        clearTimeout(controlBarHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(document.fullscreenElement === playerRef.current);
      setIsControlBarVisible(true);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const resetPlaybackForEpisode = (episodeNumber: number) => {
    const art = artPlayerRef.current;

    setActiveEpisode(episodeNumber);
    setCurrentPlaybackSeconds(0);
    setIsPlaying(false);

    if (art) {
      art.pause();
      art.currentTime = 0;
    }
  };

  const playNextEpisode = () => {
    const nextEpisode = activeEpisode >= playPageData.episodes.length ? 1 : activeEpisode + 1;

    resetPlaybackForEpisode(nextEpisode);
  };

  const skipPlayback = (seconds: number) => {
    const art = artPlayerRef.current;

    if (!art) {
      setCurrentPlaybackSeconds((value) => clamp(value + seconds, 0, usablePlaybackDuration));
      return;
    }

    const nextTime = clamp(art.currentTime + seconds, 0, usablePlaybackDuration);
    art.currentTime = nextTime;
    setCurrentPlaybackSeconds(nextTime);
  };

  const togglePlayerPanel = (panel: "volume" | "danmaku" | "settings") => {
    setIsControlBarVisible(true);
    setActivePlayerPanel((currentPanel) => (currentPanel === panel ? null : panel));
  };

  const updateVolumePanelPosition = () => {
    const contentRect = controlBarContentRef.current?.getBoundingClientRect();
    const volumeRect = volumeControlRef.current?.getBoundingClientRect();

    if (!contentRect || !volumeRect) {
      return;
    }

    setVolumePanelLeft(volumeRect.left - contentRect.left + volumeRect.width / 2);
  };

  const showVolumePanel = () => {
    if (volumeHoverTimeoutRef.current) {
      clearTimeout(volumeHoverTimeoutRef.current);
      volumeHoverTimeoutRef.current = null;
    }

    updateVolumePanelPosition();
    setIsControlBarVisible(true);
    setIsVolumePanelHovered(true);
  };

  const hideVolumePanelSoon = () => {
    if (volumeHoverTimeoutRef.current) {
      clearTimeout(volumeHoverTimeoutRef.current);
    }

    volumeHoverTimeoutRef.current = setTimeout(() => {
      setIsVolumePanelHovered(false);
    }, 120);
  };

  const clearControlBarHideTimeout = useCallback(() => {
    if (controlBarHideTimeoutRef.current) {
      clearTimeout(controlBarHideTimeoutRef.current);
      controlBarHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlBarHide = useCallback(() => {
    clearControlBarHideTimeout();

    if (!isPlaying || activePlayerPanel || isVolumePanelVisible) {
      return;
    }

    controlBarHideTimeoutRef.current = setTimeout(() => {
      setIsControlBarVisible(false);
    }, 1800);
  }, [activePlayerPanel, clearControlBarHideTimeout, isPlaying, isVolumePanelVisible]);

  const showControlBar = useCallback(() => {
    setIsControlBarVisible(true);
    scheduleControlBarHide();
  }, [scheduleControlBarHide]);

  const hideControlBar = useCallback(() => {
    clearControlBarHideTimeout();

    if (!isPlaying || activePlayerPanel || isVolumePanelVisible) {
      return;
    }

    setIsControlBarVisible(false);
  }, [activePlayerPanel, clearControlBarHideTimeout, isPlaying, isVolumePanelVisible]);

  useEffect(() => {
    if (!isControlBarVisible) {
      clearControlBarHideTimeout();
      return;
    }

    scheduleControlBarHide();

    return clearControlBarHideTimeout;
  }, [clearControlBarHideTimeout, isControlBarVisible, scheduleControlBarHide]);

  const toggleNativeFullscreen = async () => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    try {
      if (document.fullscreenElement === player) {
        await document.exitFullscreen();
        return;
      }

      await player.requestFullscreen();
      setIsControlBarVisible(true);
    } catch {
      setIsControlBarVisible(true);
    }
  };

  const togglePlayback = async () => {
    const art = artPlayerRef.current;

    if (!art) {
      setIsControlBarVisible(true);
      setIsPlaying((value) => !value);
      return;
    }

    if (!art.playing) {
      try {
        setIsControlBarVisible(true);
        await art.play();
      } catch {
        setPlaybackError("浏览器阻止了播放，请再次点击播放。");
      }
      return;
    }

    setIsControlBarVisible(true);
    art.pause();
  };

  const updatePlaybackProgress = (seconds: number) => {
    const art = artPlayerRef.current;
    const nextTime = clamp(seconds, 0, usablePlaybackDuration);

    if (art) {
      art.currentTime = nextTime;
    }

    setCurrentPlaybackSeconds(nextTime);
  };

  return (
    <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[100rem] gap-5">
        <nav aria-label="播放导航" className="flex min-w-0 items-center gap-2 text-sm text-default-500">
          <a className="truncate font-medium text-default-600 transition-colors hover:text-accent" href="#">
            {playPageData.title}
          </a>
          <i aria-hidden="true" className="bi bi-chevron-right text-xs" />
          <span className="truncate text-foreground">第 {activeEpisode} 集</span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div
            ref={playerRef}
            className={`relative aspect-video min-h-[260px] overflow-hidden bg-zinc-950 md:min-h-[520px] ${isWebFullscreen
              ? "fixed inset-x-0 top-16 z-50 aspect-auto h-[calc(100dvh-4rem)] min-h-0"
              : ""
              } ${isNativeFullscreen
                ? "aspect-auto h-screen w-screen min-h-0"
                : ""
              }`}
            onKeyDown={showControlBar}
            onMouseEnter={showControlBar}
            onMouseLeave={hideControlBar}
            onMouseMove={showControlBar}
            onTouchStart={showControlBar}
          >
            <div
              ref={artContainerRef}
              aria-label={`${playPageData.title} 第 ${activeEpisode} 集视频`}
              data-mixtv-artplayer
              className="absolute inset-0 h-full w-full bg-black [&_.art-bottom]:!hidden [&_.art-controls]:!hidden [&_.art-mask]:!hidden [&_.art-progress]:!hidden [&_.art-video-player]:h-full [&_.art-video-player]:w-full"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_56%,rgba(0,0,0,0.32)_100%)]" />
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-6 text-center text-white transition-opacity ${shouldShowPlaybackOverlay ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {isPlaybackReady ? (
                <button
                  type="button"
                  aria-label={isPlaying ? "暂停" : "播放"}
                  className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/14 text-white shadow-2xl backdrop-blur transition-transform hover:cursor-pointer hover:scale-105"
                  onClick={togglePlayback}
                >
                  <i aria-hidden="true" className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"} translate-x-0.5 text-5xl leading-none`} />
                </button>
              ) : null}
              {playbackError ? <p className="max-w-md text-sm text-danger-300">{playbackError}</p> : null}
              {/* <div className="min-w-0">
                <p className="text-sm text-white/64">{currentSource.name} · {currentSource.quality}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
                  {playPageData.title} 第 {activeEpisode} 集
                </h1>
                {playbackError ? <p className="mt-3 text-sm text-danger-300">{playbackError}</p> : null}
              </div> */}
            </div>
            <div className={`absolute bottom-3 left-1/2 z-40 grid w-[calc(100%-1.5rem)] max-w-[620px] -translate-x-1/2 gap-2 rounded-lg border border-white/16 bg-zinc-700/46 px-3 pb-0 pt-3 text-white shadow-2xl backdrop-blur-xl transition-opacity duration-300 sm:w-[min(68%,620px)] sm:px-4 sm:pb-0 ${isControlBarVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <input
                aria-label="播放进度"
                className="h-1 w-full cursor-pointer accent-[var(--accent)]"
                max={usablePlaybackDuration}
                min={0}
                title="播放进度"
                type="range"
                value={currentPlaybackSeconds}
                onChange={(event) => updatePlaybackProgress(Number(event.currentTarget.value))}
              />

              <div ref={controlBarContentRef} className="relative">
                {isVolumePanelVisible ? (
                  <div
                    className="absolute bottom-12 z-50 grid -translate-x-1/2 rounded-md border border-white/12 bg-zinc-800/90 px-3 py-3 text-xs shadow-xl backdrop-blur-xl"
                    style={{ left: volumePanelLeft ?? 0 }}
                    onMouseEnter={showVolumePanel}
                    onMouseLeave={hideVolumePanelSoon}
                  >
                    <label className="grid justify-items-center gap-2 text-white/82">
                      <span className="font-medium tabular-nums">{volume}%</span>
                      <input
                        aria-label="音量"
                        className="h-28 w-1 cursor-pointer accent-[var(--accent)] [direction:rtl] [writing-mode:vertical-lr]"
                        max={100}
                        min={0}
                        title="音量"
                        type="range"
                        value={volume}
                        onChange={(event) => setVolume(Number(event.currentTarget.value))}
                      />
                    </label>
                  </div>
                ) : null}

                {activePlayerPanel === "settings" ? (
                  <div className="absolute bottom-12 right-12 grid w-44 gap-3 rounded-md border border-white/12 bg-zinc-800/90 p-3 text-xs shadow-xl backdrop-blur-xl">
                    <label className="grid gap-1 text-white/82">
                      <span>播放速度</span>
                      <select
                        className="rounded border border-white/12 bg-zinc-900 px-2 py-1 text-white"
                        value={playbackRate}
                        onChange={(event) => setPlaybackRate(Number(event.currentTarget.value))}
                      >
                        <option value={0.75}>0.75x</option>
                        <option value={1}>1.0x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2.0x</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-white/82">
                      <span>清晰度</span>
                      <select
                        className="rounded border border-white/12 bg-zinc-900 px-2 py-1 text-white"
                        value={activeSource}
                        onChange={(event) => setActiveSource(event.currentTarget.value)}
                      >
                        {playPageData.sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.quality}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <div className="scrollbar-hide flex min-w-0 items-center gap-1.5 overflow-x-auto text-white/90 sm:gap-2">
                  <button
                    type="button"
                    aria-label={isPlaying ? "暂停" : "播放"}
                    title={isPlaying ? "暂停" : "播放"}
                    className={`${playerControlButtonClassName} text-xl`}
                    onClick={togglePlayback}
                  >
                    <i aria-hidden="true" className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"}`} />
                  </button>
                  <button
                    type="button"
                    aria-label="下一集"
                    title="下一集"
                    className={playerControlButtonClassName}
                    onClick={playNextEpisode}
                  >
                    <i aria-hidden="true" className="bi bi-skip-forward-fill" />
                  </button>
                  <button
                    type="button"
                    aria-label="后退 10 秒"
                    title="后退 10 秒"
                    className={playerControlButtonClassName}
                    onClick={() => skipPlayback(-10)}
                  >
                    <i aria-hidden="true" className="bi bi-arrow-counterclockwise" />
                  </button>
                  <button
                    type="button"
                    aria-label="前进 10 秒"
                    title="前进 10 秒"
                    className={playerControlButtonClassName}
                    onClick={() => skipPlayback(10)}
                  >
                    <i aria-hidden="true" className="bi bi-arrow-clockwise" />
                  </button>
                  <div
                    ref={volumeControlRef}
                    className="shrink-0"
                    onMouseEnter={showVolumePanel}
                    onMouseLeave={hideVolumePanelSoon}
                  >
                    <button
                      type="button"
                      aria-label="声音调节"
                      title="声音调节"
                      className={playerControlButtonClassName}
                      onClick={() => {
                        updateVolumePanelPosition();
                        togglePlayerPanel("volume");
                      }}
                    >
                      <i aria-hidden="true" className={`bi ${volumeIconClassName}`} />
                    </button>
                  </div>

                  <span
                    aria-label={`当前时长 ${currentPlaybackTime}，总时长 ${totalPlaybackTime}`}
                    className="mx-1 shrink-0 text-xs font-medium tabular-nums text-white/78 sm:mx-2 sm:text-sm"
                    title="当前时长 / 总时长"
                  >
                    {currentPlaybackTime} / {totalPlaybackTime}
                  </span>

                  <span className="min-w-0 flex-1" />

                  <Popover
                    isOpen={activePlayerPanel === "danmaku"}
                    onOpenChange={(isOpen) => {
                      setIsControlBarVisible(true);
                      setActivePlayerPanel(isOpen ? "danmaku" : null);
                    }}
                  >
                    <Popover.Trigger
                      aria-label="弹幕设置"
                      className={playerControlButtonClassName}
                      title="弹幕设置"
                    >
                      <i aria-hidden="true" className={`bi ${isDanmakuEnabled ? "bi-chat-dots-fill" : "bi-chat-dots"}`} />
                    </Popover.Trigger>
                    <Popover.Content
                      className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-white/12 bg-zinc-800/92 p-0 text-xs text-white shadow-xl backdrop-blur-xl"
                      offset={12}
                      placement="top"
                    >
                      <Popover.Dialog className="grid gap-4 p-4 outline-none">
                        <div className="flex items-center justify-between gap-3">
                          <Popover.Heading className="font-medium text-white/90">弹幕设置</Popover.Heading>
                          <Switch
                            aria-label="开启弹幕"
                            isSelected={isDanmakuEnabled}
                            onChange={setIsDanmakuEnabled}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch>
                        </div>

                        <div className="grid gap-2">
                          <span className="text-white/72">按类型屏蔽</span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "滚动", active: isRollingDanmakuBlocked, onClick: () => setIsRollingDanmakuBlocked((value) => !value) },
                              { label: "顶部", active: isTopDanmakuBlocked, onClick: () => setIsTopDanmakuBlocked((value) => !value) },
                              { label: "底部", active: isBottomDanmakuBlocked, onClick: () => setIsBottomDanmakuBlocked((value) => !value) },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                aria-pressed={item.active}
                                className={`h-8 rounded border text-xs font-medium transition-colors hover:cursor-pointer ${item.active ? "border-accent bg-accent/18 text-white" : "border-white/12 bg-white/6 text-white/62 hover:text-white"}`}
                                onClick={item.onClick}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            aria-pressed={isDanmakuOverlapPrevented}
                            className={`h-8 rounded border text-xs font-medium transition-colors hover:cursor-pointer ${isDanmakuOverlapPrevented ? "border-accent bg-accent/18 text-white" : "border-white/12 bg-white/6 text-white/62 hover:text-white"}`}
                            onClick={() => setIsDanmakuOverlapPrevented((value) => !value)}
                          >
                            防重叠
                          </button>
                          <button
                            type="button"
                            aria-pressed={isDanmakuSpeedSynced}
                            className={`h-8 rounded border text-xs font-medium transition-colors hover:cursor-pointer ${isDanmakuSpeedSynced ? "border-accent bg-accent/18 text-white" : "border-white/12 bg-white/6 text-white/62 hover:text-white"}`}
                            onClick={() => setIsDanmakuSpeedSynced((value) => !value)}
                          >
                            同步视频速度
                          </button>
                        </div>

                        <label className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.85rem] items-center gap-3 text-white/82">
                          <span>不透明度</span>
                          <input
                            aria-label="弹幕不透明度"
                            className="h-1 w-full cursor-pointer accent-[var(--accent)]"
                            max={100}
                            min={20}
                            type="range"
                            value={danmakuOpacity}
                            onChange={(event) => setDanmakuOpacity(Number(event.currentTarget.value))}
                          />
                          <span className="text-right tabular-nums text-white/68">{danmakuOpacity}%</span>
                        </label>

                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.85rem] items-center gap-3 text-white/82">
                          <span>显示区域</span>
                          <div className="relative grid grid-cols-4 items-start">
                            <span className="absolute left-5 right-5 top-1 h-px bg-white/18" />
                            {danmakuDisplayAreas.map((area) => {
                              const isSelected = danmakuDisplayArea === area.value;

                              return (
                                <button
                                  key={area.value}
                                  type="button"
                                  aria-pressed={isSelected}
                                  className="relative z-10 grid justify-items-center gap-1 text-[11px] text-white/62 transition-colors hover:cursor-pointer hover:text-white"
                                  onClick={() => setDanmakuDisplayArea(area.value)}
                                >
                                  <span className={`w-2 h-2 rounded-full border transition-colors ${isSelected ? "border-accent bg-accent shadow-[0_0_0_3px_rgba(255,255,255,0.08)]" : "border-white/28 bg-zinc-800"}`} />
                                  <span>{area.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-right tabular-nums text-white/68">{selectedDanmakuDisplayAreaLabel}</span>
                        </div>

                        <label className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.85rem] items-center gap-3 text-white/82">
                          <span>弹幕字号</span>
                          <input
                            aria-label="弹幕字号"
                            className="h-1 w-full cursor-pointer accent-[var(--accent)]"
                            max={50}
                            min={20}
                            type="range"
                            value={danmakuFontSize}
                            onChange={(event) => setDanmakuFontSize(Number(event.currentTarget.value))}
                          />
                          <span className="text-right tabular-nums text-white/68">{danmakuFontSize}px</span>
                        </label>

                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.85rem] items-center gap-3 text-white/82">
                          <span>弹幕速度</span>
                          <div className="relative grid grid-cols-5 items-start">
                            <span className="absolute left-4 right-4 top-1 h-px bg-white/18" />
                            {danmakuSpeedOptions.map((speed) => {
                              const isSelected = danmakuSpeed === speed.value;
                              const shouldShowLabel =
                                speed.value === "very-slow" || speed.value === "normal" || speed.value === "very-fast";

                              return (
                                <button
                                  key={speed.value}
                                  type="button"
                                  aria-pressed={isSelected}
                                  className="relative z-10 grid justify-items-center gap-1 text-[11px] text-white/62 transition-colors hover:cursor-pointer hover:text-white"
                                  onClick={() => setDanmakuSpeed(speed.value)}
                                >
                                  <span className={`w-2 h-2 rounded-full border transition-colors ${isSelected ? "border-accent bg-accent shadow-[0_0_0_3px_rgba(255,255,255,0.08)]" : "border-white/28 bg-zinc-800"}`} />
                                  <span>{shouldShowLabel ? speed.label : null}</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-right tabular-nums text-white/68">{selectedDanmakuSpeedLabel}</span>
                        </div>
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
                  {/* <button
                    type="button"
                    aria-label="设置"
                    title="设置"
                    className={playerControlButtonClassName}
                    onClick={() => togglePlayerPanel("settings")}
                  >
                    <i aria-hidden="true" className="bi bi-gear-fill" />
                  </button> */}
                  <button
                    type="button"
                    aria-label="网页全屏"
                    title="网页全屏"
                    className={playerControlButtonClassName}
                    onClick={() => {
                      if (artPlayerRef.current) {
                        artPlayerRef.current.fullscreenWeb = !artPlayerRef.current.fullscreenWeb;
                        return;
                      }

                      setIsWebFullscreen((value) => !value);
                    }}
                  >
                    <i aria-hidden="true" className={`bi text-base ${isWebFullscreen ? "bi-fullscreen-exit" : "bi-aspect-ratio"}`} />
                  </button>
                  <button
                    type="button"
                    aria-label="全屏"
                    title="全屏"
                    className={playerControlButtonClassName}
                    onClick={toggleNativeFullscreen}
                  >
                    <i aria-hidden="true" className={`bi text-base ${isNativeFullscreen ? "bi-fullscreen-exit" : "bi-arrows-fullscreen"}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                        className={`h-7 min-w-[3.5rem] rounded px-3 text-sm font-medium transition-colors ${episode.number === activeEpisode
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
                  {playPageData.sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className={`relative grid gap-3 rounded-lg border p-4 text-left transition-colors ${source.id === activeSource
                        ? "border-accent bg-white/2"
                        : "border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-white/12 hover:border-[color-mix(in_srgb,var(--accent)_38%,transparent)] hover:bg-white/16"
                        }`}
                      onClick={() => setActiveSource(source.id)}
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
                          {playPageData.episodes.length} 集
                        </Chip>
                      </span>
                    </button>
                  ))}
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl bg-[var(--surface)] p-4 shadow-sm backdrop-blur md:grid-cols-[180px_minmax(0,1fr)] md:p-5">
          <div className="relative aspect-[2/3] w-36 overflow-hidden rounded-lg bg-default-100 md:w-full">
            <Image
              src={playPageData.posterUrl}
              alt={`${playPageData.title} 封面`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 180px"
              priority
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-default-500">{playPageData.originalTitle}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{playPageData.title}</h2>
              </div>
              <Button
                aria-pressed={isFavorite}
                size="sm"
                variant={isFavorite ? "primary" : "outline"}
                onPress={() => setIsFavorite((value) => !value)}
              >
                <i aria-hidden="true" className={`bi ${isFavorite ? "bi-heart-fill" : "bi-heart"}`} />
                {isFavorite ? "已收藏" : "收藏"}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {playPageData.tags.map((tag) => (
                <Chip key={tag} color="accent" variant="soft">
                  {tag}
                </Chip>
              ))}
            </div>

            <Separator className="my-5" />

            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-default-500">片源</dt>
                <dd className="mt-1 font-medium text-foreground">{currentSource.name}</dd>
              </div>
              <div>
                <dt className="text-default-500">年份</dt>
                <dd className="mt-1 font-medium text-foreground">{playPageData.year}</dd>
              </div>
              <div>
                <dt className="text-default-500">地区</dt>
                <dd className="mt-1 font-medium text-foreground">{playPageData.area}</dd>
              </div>
              <div>
                <dt className="text-default-500">评分</dt>
                <dd className="mt-1 font-medium text-foreground">{playPageData.rating}</dd>
              </div>
            </dl>

            <p className="mt-5 text-sm leading-7 text-default-600">{playPageData.description}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
