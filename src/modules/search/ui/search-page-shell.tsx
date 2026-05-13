"use client";

import { Button, Chip } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type SearchType = "media" | "cloud";
type ViewMode = "grid" | "list";
type SortMode = "relevance" | "year-desc" | "year-asc";
type SearchStreamStatus = "idle" | "searching" | "complete";

type SearchResult = {
  id: string;
  title: string;
  year: number;
  type: SearchType;
  source: string;
  sourceNames: string[];
  category: string;
  coverUrl: string;
  episodeCount: number;
  remarks: string;
};

const searchTypes: Array<{ key: SearchType; label: string; icon: string }> = [
  { key: "media", label: "影视资源", icon: "bi-film" },
  { key: "cloud", label: "网盘资源", icon: "bi-cloud-arrow-down" },
];

const historyKeywords = ["庆余年", "沙丘", "繁花", "鬼灭之刃", "三体", "周处除三害", "银河护卫队"];
const titleFilters = ["全部", "电影", "剧集", "动漫", "综艺"];
const sampleTitles = [
  "庆余年 第二季",
  "沙丘：第二部",
  "繁花",
  "三体",
  "鬼灭之刃 柱训练篇",
  "年会不能停！",
  "周处除三害",
  "九龙城寨之围城",
  "银河护卫队3",
  "长安三万里",
  "漫长的季节",
  "奥本海默",
  "封神第一部",
  "人生大事",
  "流浪地球2",
  "铃芽之旅",
];
const sampleCoverUrls = [
  "https://ts1.tc.mm.bing.net/th?id=OHR.SkradinskiBuk_ZH-CN0882603359_3840x2160.avif",
  "https://via.placeholder.com/384x576/1f2937/f8fafc?text=MixTV",
  "https://via.placeholder.com/384x576/273449/f8fafc?text=Movie",
  "https://via.placeholder.com/384x576/143333/f8fafc?text=Series",
];
const fallbackCoverUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='384' height='576' viewBox='0 0 384 576'%3E%3Crect width='384' height='576' fill='%23e5e7eb'/%3E%3Crect x='54' y='72' width='276' height='432' rx='18' fill='%23f8fafc' stroke='%23cbd5e1' stroke-width='3'/%3E%3Ccircle cx='192' cy='252' r='48' fill='%230d8aff'/%3E%3Cpath d='M178 224v56l48-28z' fill='white'/%3E%3Ctext x='192' y='354' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='34' font-weight='700' fill='%23334155'%3EMixTV%3C/text%3E%3C/svg%3E";
const streamedBatchSize = 16;
const streamedBatchDelayMs = 120;

function isSearchType(value: string | null): value is SearchType {
  return value === "media" || value === "cloud";
}

function isViewMode(value: string | null): value is ViewMode {
  return value === "grid" || value === "list";
}

function isSortMode(value: string | null): value is SortMode {
  return value === "relevance" || value === "year-desc" || value === "year-asc";
}

function getUrlSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function buildMockResults(query: string, type: SearchType): SearchResult[] {
  const keyword = query.trim() || "搜索";
  const sourcePrefix = type === "media" ? "视频源" : "网盘源";
  const categories = ["电影", "剧集", "动漫", "综艺"];

  return Array.from({ length: 160 }, (_, index) => {
    const title = sampleTitles[index % sampleTitles.length];
    const category = categories[index % categories.length];
    const year = 2026 - (index % 9);

    return {
      id: `${type}-${keyword}-${index}`,
      title: index % 3 === 0 ? `${keyword} · ${title}` : `${title} · ${keyword}`,
      year,
      type,
      source: `${sourcePrefix} ${String((index % 6) + 1).padStart(2, "0")}`,
      sourceNames: Array.from({ length: (index % 5) + 1 }, (_, sourceIndex) => {
        return `${sourcePrefix} ${String(((index + sourceIndex) % 8) + 1).padStart(2, "0")}`;
      }),
      category,
      coverUrl: sampleCoverUrls[index % sampleCoverUrls.length],
      episodeCount: category === "电影" ? 1 : 8 + (index % 36),
      remarks: index % 4 === 0 ? "完结" : index % 4 === 1 ? "更新至最新" : index % 4 === 2 ? "中字" : "多版本",
    };
  });
}

function FavoriteButton({ result }: { result: SearchResult }) {
  return (
    <button
      aria-label={`收藏 ${result.title}`}
      className="absolute bottom-2.5 right-2.5 z-20 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 opacity-0 transition duration-200 hover:scale-110 hover:text-accent group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:text-accent"
      type="button"
    >
      <i aria-hidden="true" className="bi bi-heart" />
    </button>
  );
}

function ResultCover({ result, priority = false }: { result: SearchResult; priority?: boolean }) {
  const [imageError, setImageError] = useState(false);
  const coverUrl = imageError ? fallbackCoverUrl : result.coverUrl;

  return (
    <Image
      src={coverUrl}
      alt=""
      fill
      priority={priority}
      className="object-cover transition duration-700 group-hover:scale-[1.045] group-hover:saturate-110"
      sizes="(max-width: 520px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 20vw, 16vw"
      onError={() => setImageError(true)}
    />
  );
}

function useResponsiveColumns(viewMode: ViewMode) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    function updateColumns() {
      if (viewMode === "list") {
        setColumns(1);
        return;
      }

      if (window.matchMedia("(min-width: 1536px)").matches) {
        setColumns(6);
      } else if (window.matchMedia("(min-width: 1280px)").matches) {
        setColumns(5);
      } else if (window.matchMedia("(min-width: 1024px)").matches) {
        setColumns(4);
      } else if (window.matchMedia("(min-width: 768px)").matches) {
        setColumns(3);
      } else if (window.matchMedia("(min-width: 520px)").matches) {
        setColumns(2);
      } else {
        setColumns(1);
      }
    }

    updateColumns();
    window.addEventListener("resize", updateColumns);

    return () => window.removeEventListener("resize", updateColumns);
  }, [viewMode]);

  return columns;
}

function SearchResultItem({ result, viewMode }: { result: SearchResult; viewMode: ViewMode }) {
  if (viewMode === "grid") {
    return (
      <article className="group grid min-w-0 content-start overflow-hidden rounded-[1.15rem] bg-surface/78 text-left shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="relative aspect-[2/3] overflow-hidden bg-surface-secondary">
          <Link aria-label={`播放 ${result.title}`} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" href="/play">
            <ResultCover result={result} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,transparent_34%,rgba(0,0,0,0.84)_100%)] opacity-85 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
            <div className="absolute left-2.5 top-2.5 z-10">
              <Chip className="h-6 rounded-full bg-white/14 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md" size="sm" variant="soft">
                {result.year}
              </Chip>
            </div>
            {result.episodeCount > 1 ? (
              <Chip
                className="absolute right-2.5 top-2.5 z-10 h-6 rounded-full bg-white/14 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md"
                size="sm"
                variant="soft"
              >
                {result.episodeCount}集
              </Chip>
            ) : null}
            <Chip
              className="absolute bottom-2.5 left-2.5 z-10 h-6 rounded-full bg-white/14 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md"
              size="sm"
              variant="soft"
            >
              {result.sourceNames.length}源
            </Chip>
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-xl text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.32)] ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
              <i aria-hidden="true" className="bi bi-play-fill translate-x-px" />
            </span>
          </Link>
          <FavoriteButton result={result} />
        </div>
        <Link aria-label={`播放 ${result.title}`} className="grid gap-2.5 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" href="/play">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
            {result.title}
          </h3>
        </Link>
      </article>
    );
  }

  return (
    <article className="group grid w-full grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-3 rounded-[1rem] bg-surface/78 p-3 text-left shadow-[0_12px_36px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:bg-surface hover:shadow-[0_20px_54px_rgba(15,23,42,0.13)] sm:grid-cols-[6rem_minmax(0,1fr)_3rem] sm:items-center">
      <div className="relative h-32 w-[5.25rem] overflow-hidden rounded-xl bg-surface-secondary ring-1 ring-default-200/80 sm:h-36 sm:w-24">
        <Link aria-label={`播放 ${result.title}`} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" href="/play">
          <ResultCover result={result} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
          <Chip className="absolute left-1.5 top-1.5 z-10 h-5 rounded-full bg-white/14 px-2 text-[10px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md" size="sm" variant="soft">
            {result.year}
          </Chip>
          {result.episodeCount > 1 ? (
            <Chip className="absolute right-1.5 top-1.5 z-10 h-5 rounded-full bg-white/14 px-2 text-[10px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md" size="sm" variant="soft">
              {result.episodeCount}集
            </Chip>
          ) : null}
          <Chip className="absolute bottom-1.5 left-1.5 z-10 h-5 rounded-full bg-white/14 px-2 text-[10px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md" size="sm" variant="soft">
            {result.sourceNames.length}源
          </Chip>
        </Link>
        <FavoriteButton result={result} />
      </div>
      <Link aria-label={`播放 ${result.title}`} className="grid min-w-0 gap-2 outline-none focus-visible:ring-2 focus-visible:ring-accent" href="/play">
        <span className="line-clamp-2 text-base font-semibold leading-6 text-foreground transition-colors group-hover:text-accent">{result.title}</span>
        <span className="flex flex-wrap gap-1.5">
          <Chip className="rounded-full bg-default-100 px-2.5 text-default-600 ring-1 ring-default-200" size="sm" variant="soft">
            {result.year}
          </Chip>
          <Chip className="rounded-full bg-accent/12 px-2.5 text-accent ring-1 ring-accent/25" size="sm" variant="soft">
            {result.category}
          </Chip>
          <Chip className="rounded-full bg-amber-500/12 px-2.5 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300" size="sm" variant="soft">
            {result.remarks}
          </Chip>
        </span>
      </Link>
      <Link
        aria-label={`播放 ${result.title}`}
        className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-accent-foreground shadow-md outline-none transition-transform group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent sm:grid"
        href="/play"
      >
        <i aria-hidden="true" className="bi bi-play-fill translate-x-px" />
      </Link>
    </article>
  );
}

function VirtualizedResults({
  resetKey,
  results,
  viewMode,
}: {
  resetKey: string;
  results: SearchResult[];
  viewMode: ViewMode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columns = useResponsiveColumns(viewMode);
  const rowHeight = viewMode === "list" ? 172 : columns <= 2 ? 520 : columns <= 4 ? 500 : 460;
  const rowCount = Math.ceil(results.length / columns);
  useLayoutEffect(() => {
    function updateScrollMargin() {
      const listElement = listRef.current;

      if (!listElement) {
        return;
      }

      setScrollMargin(listElement.getBoundingClientRect().top + window.scrollY);
    }

    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);

    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [columns, resetKey, viewMode]);

  // TanStack Virtual is the intended virtual scrolling engine for this page-level result list.
  const rowVirtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 4,
    scrollMargin,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, resetKey, rowHeight, rowVirtualizer, viewMode]);

  return (
    <div ref={listRef} className="pr-1" role="list">
      <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const rowItems = results.slice(rowIndex * columns, rowIndex * columns + columns);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 right-0 grid gap-5 pb-5"
              data-index={virtualRow.index}
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
              }}
            >
              {rowItems.map((result) => (
                <div key={result.id} role="listitem">
                  <SearchResultItem result={result} viewMode={viewMode} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SearchPageShell() {
  const [searchType, setSearchType] = useState<SearchType>(() => {
    const type = getUrlSearchParams().get("type");
    return isSearchType(type) ? type : "media";
  });
  const [queryInput, setQueryInput] = useState(() => getUrlSearchParams().get("q") ?? "");
  const [activeQuery, setActiveQuery] = useState(() => getUrlSearchParams().get("q")?.trim() ?? "");
  const [searchRequestId, setSearchRequestId] = useState(0);
  const [streamStatus, setStreamStatus] = useState<SearchStreamStatus>("idle");
  const [streamedResults, setStreamedResults] = useState<SearchResult[]>([]);
  const [completedSources, setCompletedSources] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [titleFilter, setTitleFilter] = useState(() => getUrlSearchParams().get("category") ?? "全部");
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const sort = getUrlSearchParams().get("sort");
    return isSortMode(sort) ? sort : "relevance";
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const view = getUrlSearchParams().get("view");
    return isViewMode(view) ? view : "grid";
  });

  const hasSearched = activeQuery.trim().length > 0;
  const baseResults = streamedResults;
  const isStreaming = streamStatus === "searching";
  const resultResetKey = `${searchType}-${activeQuery}-${searchRequestId}`;

  useEffect(() => {
    const normalizedQuery = activeQuery.trim();

    if (!normalizedQuery) {
      return;
    }

    const allResults = buildMockResults(normalizedQuery, searchType);
    const sourceCount = Math.ceil(allResults.length / streamedBatchSize);
    let completedBatchCount = 0;
    let intervalId: number | undefined;

    const startTimeoutId = window.setTimeout(() => {
      setStreamStatus("searching");
      setStreamedResults([]);
      setCompletedSources(0);
      setTotalSources(sourceCount);

      intervalId = window.setInterval(() => {
        completedBatchCount += 1;

        setStreamedResults(allResults.slice(0, completedBatchCount * streamedBatchSize));
        setCompletedSources(completedBatchCount);

        if (completedBatchCount >= sourceCount) {
          window.clearInterval(intervalId);
          setStreamStatus("complete");
        }
      }, streamedBatchDelayMs);
    }, 0);

    return () => {
      window.clearTimeout(startTimeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [activeQuery, searchRequestId, searchType]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();

    if (activeQuery.trim()) {
      params.set("q", activeQuery.trim());
    }

    if (searchType !== "media") {
      params.set("type", searchType);
    }

    if (titleFilter !== "全部") {
      params.set("category", titleFilter);
    }

    if (sortMode !== "relevance") {
      params.set("sort", sortMode);
    }

    if (viewMode !== "grid") {
      params.set("view", viewMode);
    }

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);
  }, [activeQuery, searchType, sortMode, titleFilter, viewMode]);

  const visibleResults = useMemo(() => {
    const filtered = baseResults.filter((result) => {
      const matchesTitle = titleFilter === "全部" || result.category === titleFilter;

      return matchesTitle;
    });

    if (sortMode === "year-desc") {
      return [...filtered].sort((left, right) => right.year - left.year);
    }

    if (sortMode === "year-asc") {
      return [...filtered].sort((left, right) => left.year - right.year);
    }

    return filtered;
  }, [baseResults, sortMode, titleFilter]);

  function runSearch(keyword = queryInput) {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      return;
    }

    setQueryInput(normalizedKeyword);
    setActiveQuery(normalizedKeyword);
    setStreamStatus("searching");
    setStreamedResults([]);
    setCompletedSources(0);
    setTotalSources(0);
    setTitleFilter("全部");
    setSortMode("relevance");
    setSearchRequestId((value) => value + 1);
  }

  return (
    <section className="min-h-screen w-full px-4 py-6 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[100rem] content-start gap-8">
        <form
          className="mx-auto grid w-full max-w-4xl gap-4 md:mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-xl bg-surface/80 px-4 py-2 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            {searchTypes.map((type) => (
              <Button
                key={type.key}
                aria-pressed={searchType === type.key}
                className="h-11 rounded-full px-5 text-base font-medium shadow-none data-[pressed=true]:scale-100"
                type="button"
                variant={searchType === type.key ? "primary" : "outline"}
                onPress={() => setSearchType(type.key)}
              >
                <i aria-hidden="true" className={`bi ${type.icon}`} />
                {type.label}
              </Button>
            ))}
          </div>
          <label className="mx-auto grid w-full max-w-3xl">
            <span className="sr-only">搜索关键词</span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-[1rem] bg-[var(--surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_36px_rgba(15,23,42,0.10)] transition focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_46px_rgba(15,23,42,0.14)]">
              <input
                className="h-14 min-w-0 bg-transparent px-5 text-base text-foreground outline-none placeholder:text-default-400"
                autoComplete="off"
                name="q"
                value={queryInput}
                placeholder="输入片名、演员、网盘链接或关键词…"
                onChange={(event) => setQueryInput(event.target.value)}
              />
              {queryInput ? (
                <button
                  aria-label="清除搜索关键词"
                  className="grid h-14 w-11 cursor-pointer place-items-center bg-transparent text-base text-default-400 transition hover:text-foreground focus-visible:outline-none focus-visible:text-accent"
                  type="button"
                  onClick={() => setQueryInput("")}
                >
                  <i aria-hidden="true" className="bi bi-x-circle-fill" />
                </button>
              ) : null}
              <Button className="h-14 rounded-none px-5 font-semibold md:px-7" type="submit" variant="primary">
                <i aria-hidden="true" className="bi bi-search" />
                搜索
              </Button>
            </span>
          </label>
        </form>

        <div className="grid gap-4">
          {hasSearched ? (
            <div className="grid gap-5">
              <div className="relative overflow-hidden rounded-[1.25rem] bg-surface/75 p-4 shadow-[0_18px_58px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-end gap-2" role="status" aria-live="polite">
                      <h1 className="truncate text-2xl font-semibold tracking-normal text-foreground">
                        {activeQuery}
                      </h1>
                      {totalSources > 0 ? (
                        <span className="pb-0.5 text-xs text-default-400">
                          {isStreaming ? `正在搜索 ${completedSources}/${totalSources}` : `已完成 ${completedSources}/${totalSources}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div aria-label="结果视图" className="flex items-center rounded-full border border-default-200/80 bg-background/70 p-1 shadow-inner" role="group">
                    {(["grid", "list"] as const).map((mode) => (
                      <Button
                        key={mode}
                        aria-label={mode === "grid" ? "切换为卡片视图" : "切换为列表视图"}
                        aria-pressed={viewMode === mode}
                        className="h-8 min-w-0 rounded-full px-3"
                        size="sm"
                        type="button"
                        variant={viewMode === mode ? "primary" : "ghost"}
                        onPress={() => setViewMode(mode)}
                      >
                        <i aria-hidden="true" className={`bi ${mode === "grid" ? "bi-grid-3x3-gap" : "bi-list-ul"}`} />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.1rem] bg-surface/72 p-3 shadow-[0_14px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div aria-label="内容类型筛选" className="flex min-w-0 flex-wrap items-center gap-2" role="group">
                  {titleFilters.map((filter) => (
                    <Button
                      key={filter}
                      aria-pressed={titleFilter === filter}
                      className="h-8 rounded-full px-3 text-sm"
                      size="sm"
                      type="button"
                      variant={titleFilter === filter ? "primary" : "ghost"}
                      onPress={() => setTitleFilter(filter)}
                    >
                      {filter}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="h-9 rounded-full px-3 text-sm"
                    size="sm"
                    type="button"
                    variant={sortMode === "relevance" ? "ghost" : "primary"}
                    onPress={() => {
                      setSortMode((currentMode) => {
                        if (currentMode === "relevance") {
                          return "year-desc";
                        }
                        if (currentMode === "year-desc") {
                          return "year-asc";
                        }
                        return "relevance";
                      });
                    }}
                  >
                    <i
                      aria-hidden="true"
                      className={`bi ${
                        sortMode === "year-desc"
                          ? "bi-sort-down"
                          : sortMode === "year-asc"
                            ? "bi-sort-up"
                            : "bi-filter"
                      }`}
                    />
                    {sortMode === "year-desc" ? "年份降序" : sortMode === "year-asc" ? "年份升序" : "综合排序"}
                  </Button>
                </div>
              </div>

              {visibleResults.length > 0 ? (
                <VirtualizedResults resetKey={resultResetKey} results={visibleResults} viewMode={viewMode} />
              ) : isStreaming ? (
                <div className="grid min-h-64 place-items-center rounded-lg border border-default-200 bg-surface/60 p-8 text-center" role="status" aria-live="polite">
                  <div className="grid justify-items-center gap-3">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-default-300 border-t-accent" />
                    <div>
                      <p className="font-medium text-foreground">正在连接搜索源</p>
                      <p className="mt-1 text-sm text-default-500">首批结果马上显示。</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-lg border border-default-200 bg-surface/60 p-8 text-center">
                  <div className="grid max-w-sm justify-items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-default-100 text-xl text-default-500">
                      <i aria-hidden="true" className="bi bi-search" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">没有符合筛选的结果</p>
                      <p className="mt-1 text-sm text-default-500">尝试切换分类、年份或重新搜索关键词。</p>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && visibleResults.length > 0 ? (
                <div className="sticky bottom-3 z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-default-200 bg-background/92 px-4 py-2 text-sm text-default-600 shadow-lg backdrop-blur" role="status" aria-live="polite">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-default-300 border-t-accent" />
                  正在搜索更多结果…
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 rounded-[1.2rem] border border-default-200/70 bg-surface/72 p-4 shadow-[0_18px_58px_rgba(15,23,42,0.07)] ring-1 ring-white/40 backdrop-blur-xl dark:ring-white/10 md:p-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-foreground">搜索历史</h1>
                <p className="mt-1 text-sm text-default-500">点击关键词直接搜索。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {historyKeywords.map((keyword) => (
                  <Button key={keyword} className="rounded-full" type="button" variant="ghost" onPress={() => runSearch(keyword)}>
                    <i aria-hidden="true" className="bi bi-clock-history" />
                    {keyword}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
