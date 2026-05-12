"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button, Chip, Separator, Tabs } from "@heroui/react";

type Episode = {
  number: number;
  title: string;
  duration: string;
};

type VideoSource = {
  id: string;
  name: string;
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

const playPageData: PlayPageData = {
  title: "星河漫游",
  originalTitle: "Stellar Roaming",
  currentEpisode: 18,
  posterUrl: "https://ts1.tc.mm.bing.net/th?id=OHR.SkradinskiBuk_ZH-CN0882603359_3840x2160.avif",
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
    { id: "source-hd-1", name: "高清源 1", quality: "1080P", latency: "低延迟", status: "流畅" },
    { id: "source-hd-2", name: "备用源 2", quality: "1080P", latency: "普通", status: "流畅" },
    { id: "source-uhd", name: "超清源", quality: "4K", latency: "普通", status: "拥挤" },
    { id: "source-mobile", name: "移动源", quality: "720P", latency: "低流量", status: "流畅" },
  ],
};

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

export function PlayPageShell() {
  const [activeEpisode, setActiveEpisode] = useState(playPageData.currentEpisode);
  const [activeSource, setActiveSource] = useState(playPageData.sources[0].id);
  const [selectedGroupKey, setSelectedGroupKey] = useState("1-50");
  const [isDescending, setIsDescending] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const episodeGroups = useMemo(() => getEpisodeGroups(playPageData.episodes), []);
  const selectedGroup = episodeGroups.find((group) => group.key === selectedGroupKey) ?? episodeGroups[0];
  const visibleEpisodes = isDescending ? [...selectedGroup.episodes].reverse() : selectedGroup.episodes;
  const currentSource = playPageData.sources.find((source) => source.id === activeSource) ?? playPageData.sources[0];

  return (
    <div className="min-h-screen px-4 py-5 text-foreground md:px-6 lg:px-8 2xl:px-12">
      <div className="mx-auto grid w-full max-w-[1800px] gap-5">
        <nav aria-label="播放导航" className="flex min-w-0 items-center gap-2 text-sm text-default-500">
          <a className="truncate font-medium text-default-600 transition-colors hover:text-accent" href="#">
            {playPageData.title}
          </a>
          <i aria-hidden="true" className="bi bi-chevron-right text-xs" />
          <span className="truncate text-foreground">第 {activeEpisode} 集</span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="relative aspect-video min-h-[260px] overflow-hidden bg-zinc-950 md:min-h-[520px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_36%),linear-gradient(135deg,var(--background),var(--surface-secondary)_48%,var(--background))]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white">
              <button
                type="button"
                aria-label="播放"
                className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-white/25 bg-white/12 text-white shadow-2xl backdrop-blur transition-transform hover:scale-105"
              >
                <i aria-hidden="true" className="bi bi-play-fill translate-x-0.5 text-5xl leading-none" />
              </button>
              <div className="min-w-0">
                <p className="text-sm text-white/64">{currentSource.name} · {currentSource.quality}</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
                  {playPageData.title} 第 {activeEpisode} 集
                </h1>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-white/10 bg-black/35 px-4 py-3 text-sm text-white/80 backdrop-blur">
              <span className="inline-flex min-w-0 items-center gap-2">
                <i aria-hidden="true" className="bi bi-badge-hd" />
                <span className="truncate">{currentSource.quality} 自动线路</span>
              </span>
              <span className="hidden items-center gap-2 sm:inline-flex">
                <i aria-hidden="true" className="bi bi-arrows-fullscreen" />
                全屏
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/20 bg-black/28 shadow-sm backdrop-blur-xl">
            <Tabs className="w-full" defaultSelectedKey="episodes" variant="secondary">
              <Tabs.ListContainer className="border-b border-white/20 p-0">
                <Tabs.List aria-label="播放控制" className="grid w-full grid-cols-2 gap-0 bg-transparent">
                  <Tabs.Tab id="episodes" className="h-12 justify-center rounded-none text-sm font-medium">
                    <span className="inline-flex items-center gap-2">
                      <i aria-hidden="true" className="bi bi-collection-play" />
                      选集
                    </span>
                  </Tabs.Tab>
                  <Tabs.Tab id="sources" className="h-12 justify-center rounded-none text-sm font-medium">
                    <span className="inline-flex items-center gap-2">
                      <i aria-hidden="true" className="bi bi-broadcast" />
                      换源
                    </span>
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>

              <Tabs.Panel id="episodes">
                <div className="grid gap-4 p-4 md:p-5">
                  <div className="flex items-center">
                    <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                      总集数 {playPageData.episodes.length}
                    </Chip>
                  </div>

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

                  <div className="grid max-h-[430px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 xl:grid-cols-5">
                    {visibleEpisodes.map((episode) => (
                      <button
                        key={episode.number}
                        type="button"
                        aria-label={`${episode.title} ${episode.duration}`}
                        className={`h-7 min-w-[3.5rem] rounded px-3 text-sm font-medium transition-colors ${
                          episode.number === activeEpisode
                            ? "bg-accent text-accent-foreground"
                            : "bg-white/65 text-default-700 hover:bg-white/85"
                        }`}
                        onClick={() => setActiveEpisode(episode.number)}
                      >
                        {episode.number}
                      </button>
                    ))}
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel id="sources">
                <div className="grid gap-3 p-4 md:p-5">
                  {playPageData.sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className={`grid gap-3 rounded-lg border p-4 text-left transition-colors ${
                        source.id === activeSource
                          ? "border-accent bg-white/12"
                          : "border-white/16 bg-white/12 hover:border-white/28 hover:bg-white/16"
                      }`}
                      onClick={() => setActiveSource(source.id)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 font-medium text-foreground">{source.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                            总集数 {playPageData.episodes.length}
                          </Chip>
                          {source.id === activeSource ? (
                            <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                              当前使用
                            </Chip>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                        <Chip className="h-5 px-1 text-[11px]" color="accent" size="sm" variant="soft">
                          {source.quality}
                        </Chip>
                        <span>{source.latency}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-default-200/70 bg-background/70 p-4 shadow-sm backdrop-blur md:grid-cols-[180px_minmax(0,1fr)] md:p-5">
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
