"use client";

import {
  ClockCircleOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  HeartFilled,
  HeartOutlined,
  TableOutlined,
  BarsOutlined,
  PlayCircleFilled,
  SearchOutlined,
  VideoCameraOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { Button, Space, Tag } from "antd";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";

type SearchType = "media" | "cloud";
type ViewMode = "grid" | "list";
type SearchStreamStatus = "idle" | "searching" | "complete";

type AggregatedMediaResource = {
  cover: string;
  id: string;
  idx: string;
  key: string;
  quality?: string;
  source_name: string;
  source_total: number;
  title: string;
  total_episodes: number;
  year: string;
};

type MediaSearchSseEvent =
  | { event: "start"; data: { total: number } }
  | { event: "result"; data: AggregatedMediaResource[] }
  | { event: "complete"; data: { completed: number; total: number } }
  | { event: "error"; data: { message?: string } };

type SearchHistoryApiResponse = {
  history?: unknown;
};

type SearchResult = {
  favoriteKey: string;
  id: string;
  resourceId: string;
  resourceKey: string;
  title: string;
  year: number;
  type: SearchType;
  source: string;
  sourceNames: string[];
  category: string;
  coverUrl: string;
  episodeCount: number;
  remarks: string;
  quality?: string;
  sourceTotal: number;
};

const searchTypes: Array<{
  key: SearchType;
  label: string;
  Icon: typeof VideoCameraOutlined;
}> = [
  { key: "media", label: "影视资源", Icon: VideoCameraOutlined },
  { key: "cloud", label: "网盘资源", Icon: CloudDownloadOutlined },
];

function isSearchType(value: string | null): value is SearchType {
  return value === "media" || value === "cloud";
}

function isViewMode(value: string | null): value is ViewMode {
  return value === "grid" || value === "list";
}

function getUrlSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function readMediaCategory(resource: AggregatedMediaResource) {
  const label = resource.title;

  if (/动漫|动画|番剧|番/.test(label)) {
    return "动漫";
  }
  if (/综艺|真人秀/.test(label)) {
    return "综艺";
  }
  if (/剧|连续|集/.test(label)) {
    return "剧集";
  }

  return "电影";
}

function mapMediaResourceToSearchResult(
  resource: AggregatedMediaResource,
): SearchResult {
  const category = readMediaCategory(resource);
  const year = Number(resource.year);
  const episodeCount = Math.max(resource.total_episodes, 1);

  return {
    favoriteKey: `${resource.key}:${resource.id}`,
    id: `media-${resource.idx}`,
    resourceId: resource.id,
    resourceKey: resource.key,
    title: resource.title,
    year: Number.isFinite(year) ? year : 0,
    type: "media",
    source: resource.source_name,
    sourceNames: [resource.source_name],
    category,
    coverUrl:
      resource.cover ||
      createPlaceholderImageUrl({
        variant: "poster",
        fileStem: resource.title,
        seed: resource.idx,
      }),
    episodeCount,
    quality: resource.quality,
    sourceTotal: resource.source_total ?? 1,
    remarks: episodeCount > 1 ? `${episodeCount}集` : "可播放",
  };
}

function createPlayHref(result: SearchResult) {
  return `/play?source=${encodeURIComponent(result.resourceKey)}&id=${encodeURIComponent(result.resourceId)}`;
}

function parseSseBlock(block: string): MediaSearchSseEvent | null {
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
      return { event, data } as MediaSearchSseEvent;
    }
  } catch {
    return null;
  }

  return null;
}

function readSseEvents(buffer: string) {
  const events: MediaSearchSseEvent[] = [];
  let remaining = buffer;
  let separatorIndex = remaining.indexOf("\n\n");

  while (separatorIndex >= 0) {
    const block = remaining.slice(0, separatorIndex).trimEnd();
    remaining = remaining.slice(separatorIndex + 2);
    const event = parseSseBlock(block);

    if (event) {
      events.push(event);
    }

    separatorIndex = remaining.indexOf("\n\n");
  }

  return { events, remaining };
}

function readSearchHistoryFromApi(data: SearchHistoryApiResponse) {
  if (!Array.isArray(data.history)) {
    return [];
  }

  return data.history.filter(
    (keyword): keyword is string => typeof keyword === "string",
  );
}

let searchHistoryLoadPromise: Promise<string[]> | null = null;

function loadSearchHistory() {
  searchHistoryLoadPromise ??= fetch("/api/search/histories", {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as SearchHistoryApiResponse;

      return readSearchHistoryFromApi(data);
    })
    .catch(() => [])
    .finally(() => {
      searchHistoryLoadPromise = null;
    });

  return searchHistoryLoadPromise;
}

function FavoriteButton({
  isFavorited,
  isPending,
  onToggle,
  result,
}: {
  isFavorited: boolean;
  isPending: boolean;
  onToggle: (result: SearchResult) => void;
  result: SearchResult;
}) {
  return (
    <button
      aria-label={`${isFavorited ? "取消收藏" : "收藏"} ${result.title}`}
      className="absolute bottom-2.5 right-2.5 z-20 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 opacity-0 transition duration-200 hover:scale-110 hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:text-red-500"
      disabled={isPending}
      type="button"
      onClick={() => onToggle(result)}
    >
      {isFavorited ? (
        <HeartFilled className="text-red-500" />
      ) : (
        <HeartOutlined />
      )}
    </button>
  );
}

function ResultCover({
  result,
  priority = false,
}: {
  result: SearchResult;
  priority?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const fallbackCoverUrl = createPlaceholderImageUrl({
    variant: "poster",
    fileStem: result.title,
    seed: result.id,
  });
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

function SearchResultItem({
  favoritedKeys,
  pendingFavoriteKeys,
  result,
  viewMode,
  onToggleFavorite,
}: {
  favoritedKeys: Set<string>;
  pendingFavoriteKeys: Set<string>;
  result: SearchResult;
  viewMode: ViewMode;
  onToggleFavorite: (result: SearchResult) => void;
}) {
  const isFavorited = favoritedKeys.has(result.favoriteKey);
  const isPending = pendingFavoriteKeys.has(result.favoriteKey);

  if (viewMode === "grid") {
    return (
      <article className="group grid min-w-0 content-start overflow-hidden rounded-xl bg-surface/80 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-md">
        <div className="relative aspect-2/3 overflow-hidden bg-surface-secondary">
          <Link
            aria-label={`播放 ${result.title}`}
            className="relative block h-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            href={createPlayHref(result)}
            rel="noreferrer"
            target="_blank"
            prefetch={false}
          >
            <ResultCover result={result} />
            <div className="absolute inset-0 bg-linear-to-b from-black/25 via-transparent to-black/85 opacity-85 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/45 to-transparent" />
            <div className="absolute left-2.5 top-2.5 z-10">
              <Tag color="default">{result.year}</Tag>
            </div>
            {result.episodeCount > 1 ? (
              <Tag color="default" className="absolute right-2.5 top-2.5">
                {result.episodeCount}集
              </Tag>
            ) : null}
            <Tag color="default" className="absolute bottom-2.5 left-2.5">
              {result.sourceTotal}源
            </Tag>
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-xl text-white opacity-0 shadow-lg ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
              <PlayCircleFilled className="translate-x-px" />
            </span>
          </Link>
          <FavoriteButton
            isFavorited={isFavorited}
            isPending={isPending}
            result={result}
            onToggle={onToggleFavorite}
          />
        </div>
        <Link
          aria-label={`播放 ${result.title}`}
          className="grid gap-2.5 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href={createPlayHref(result)}
          rel="noreferrer"
          target="_blank"
          prefetch={false}
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
            {result.title}
          </h3>
        </Link>
      </article>
    );
  }

  return (
    <article className="group grid w-full grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-3 rounded-2xl bg-surface/80 p-3 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-surface hover:shadow-md sm:grid-cols-[6rem_minmax(0,1fr)_3rem] sm:items-center">
      <div className="relative h-32 w-21 overflow-hidden rounded-xl bg-surface-secondary ring-1 ring-default-200/80 sm:h-36 sm:w-24">
        <Link
          aria-label={`播放 ${result.title}`}
          className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href={createPlayHref(result)}
          rel="noreferrer"
          target="_blank"
          prefetch={false}
        >
          <ResultCover result={result} />
          <div className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-black/30" />
          <Tag color="default">{result.year}</Tag>
          {result.episodeCount > 1 ? (
            <Tag color="default" className="absolute right-2.5">
              {result.episodeCount}集
            </Tag>
          ) : null}
          <Tag color="default" className="absolute bottom-2.5">
            {result.sourceTotal}源
          </Tag>
        </Link>
        <FavoriteButton
          isFavorited={isFavorited}
          isPending={isPending}
          result={result}
          onToggle={onToggleFavorite}
        />
      </div>
      <Link
        aria-label={`播放 ${result.title}`}
        className="grid min-w-0 gap-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        href={createPlayHref(result)}
        rel="noreferrer"
        target="_blank"
        prefetch={false}
      >
        <span className="line-clamp-2 text-base font-semibold leading-6 text-foreground transition-colors group-hover:text-accent">
          {result.title}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Tag color="default">{result.year}</Tag>
          <Tag color="processing">{result.category}</Tag>
          <Tag color="warning">{result.remarks}</Tag>
        </span>
      </Link>
      <Link
        aria-label={`播放 ${result.title}`}
        className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-accent-foreground shadow-md outline-none transition-transform group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent sm:grid"
        href={createPlayHref(result)}
        rel="noreferrer"
        target="_blank"
        prefetch={false}
      >
        <PlayCircleFilled className="translate-x-px" />
      </Link>
    </article>
  );
}

function SearchHistoryPanel({
  keywords,
  onDelete,
  onSearch,
}: {
  keywords: string[];
  onDelete: (keyword: string) => void;
  onSearch: (keyword: string) => void;
}) {
  return (
    <div className="grid gap-4 rounded-xl bg-surface p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            搜索历史
          </h1>
          <p className="mt-1 text-sm text-default-600">点击关键词直接搜索。</p>
        </div>
        <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-600">
          {keywords.length} 条
        </span>
      </div>

      {keywords.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {keywords.map((keyword) => (
            <article
              key={keyword}
              className="group grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 rounded-xl bg-surface-secondary/70 px-2.5 py-2 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-surface-secondary hover:shadow-md"
            >
              <button
                aria-label={`搜索 ${keyword}`}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-accent/10 text-sm text-accent transition group-hover:bg-accent group-hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                type="button"
                onClick={() => onSearch(keyword)}
              >
                <ClockCircleOutlined />
              </button>
              <button
                className="min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                type="button"
                onClick={() => onSearch(keyword)}
              >
                <span className="block truncate text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
                  {keyword}
                </span>
              </button>
              <button
                aria-label={`删除搜索历史 ${keyword}`}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-xs text-default-400 transition hover:bg-danger/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                type="button"
                onClick={() => onDelete(keyword)}
              >
                <DeleteOutlined />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-default-200 bg-background/50 p-8 text-center">
          <div className="grid justify-items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-default-100 text-xl text-default-500">
              <ClockCircleOutlined />
            </span>
            <div>
              <p className="font-medium text-foreground">暂无搜索历史</p>
              <p className="mt-1 text-sm text-default-600">
                搜索后会自动记录关键词。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VirtualizedResults({
  favoritedKeys,
  pendingFavoriteKeys,
  resetKey,
  results,
  viewMode,
  onToggleFavorite,
}: {
  favoritedKeys: Set<string>;
  pendingFavoriteKeys: Set<string>;
  resetKey: string;
  results: SearchResult[];
  viewMode: ViewMode;
  onToggleFavorite: (result: SearchResult) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columns = useResponsiveColumns(viewMode);
  const rowHeight =
    viewMode === "list" ? 172 : columns <= 2 ? 520 : columns <= 4 ? 500 : 460;
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
      <div
        className="relative"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const rowItems = results.slice(
            rowIndex * columns,
            rowIndex * columns + columns,
          );

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
                  <SearchResultItem
                    favoritedKeys={favoritedKeys}
                    pendingFavoriteKeys={pendingFavoriteKeys}
                    result={result}
                    viewMode={viewMode}
                    onToggleFavorite={onToggleFavorite}
                  />
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
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchRequestId, setSearchRequestId] = useState(0);
  const [streamStatus, setStreamStatus] = useState<SearchStreamStatus>("idle");
  const [streamedResults, setStreamedResults] = useState<SearchResult[]>([]);
  const [completedSources, setCompletedSources] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [streamError, setStreamError] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favoritedKeys, setFavoritedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingFavoriteKeys, setPendingFavoriteKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const view = getUrlSearchParams().get("view");
    return isViewMode(view) ? view : "grid";
  });

  const hasSearched = activeQuery.trim().length > 0;
  const baseResults = streamedResults;
  const isStreaming = streamStatus === "searching";
  const resultResetKey = `${searchType}-${activeQuery}-${searchRequestId}`;

  useEffect(() => {
    let isCurrent = true;

    void loadSearchHistory().then((history) => {
      if (isCurrent) {
        setSearchHistory(history);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  function clearSearch() {
    setQueryInput("");
    setActiveQuery("");
    setStreamStatus("idle");
    setStreamedResults([]);
    setCompletedSources(0);
    setTotalSources(0);
    setStreamError("");
    setFavoritedKeys(new Set());
    setPendingFavoriteKeys(new Set());
  }

  useEffect(() => {
    const normalizedQuery = activeQuery.trim();

    if (!normalizedQuery) {
      return;
    }

    const controller = new AbortController();

    async function readMediaSearchStream() {
      try {
        setStreamStatus("searching");
        setStreamedResults([]);
        setFavoritedKeys(new Set());
        setPendingFavoriteKeys(new Set());
        setCompletedSources(0);
        setTotalSources(0);
        setStreamError("");

        const response = await fetch(
          `/api/search/media?q=${encodeURIComponent(normalizedQuery)}`,
          {
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          throw new Error("搜索接口请求失败");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = readSseEvents(buffer);
          buffer = parsed.remaining;

          for (const event of parsed.events) {
            if (event.event === "start") {
              setTotalSources(event.data.total);
              continue;
            }

            if (event.event === "result") {
              setCompletedSources((current) => current + 1);
              setStreamedResults((current) => {
                const nextById = new Map(
                  current.map((result) => [result.id, result]),
                );

                for (const result of event.data.map(
                  mapMediaResourceToSearchResult,
                )) {
                  nextById.set(result.id, result);
                }

                return Array.from(nextById.values());
              });
              continue;
            }

            if (event.event === "complete") {
              setCompletedSources(event.data.completed);
              setTotalSources(event.data.total);
              setStreamStatus("complete");
              continue;
            }

            if (event.event === "error") {
              throw new Error(event.data.message || "搜索接口返回错误");
            }
          }
        }

        setStreamStatus((current) =>
          current === "searching" ? "complete" : current,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setStreamStatus("complete");
        setStreamError(
          error instanceof Error ? error.message : "搜索失败，请稍后重试",
        );
      }
    }

    void readMediaSearchStream();

    return () => {
      controller.abort();
    };
  }, [activeQuery, searchRequestId]);

  const visibleResults = useMemo(() => {
    return baseResults;
  }, [baseResults]);

  function runSearch(keyword = queryInput) {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      return;
    }

    setQueryInput(normalizedKeyword);
    setActiveQuery(normalizedKeyword);
    setSearchHistory((currentHistory) => [
      normalizedKeyword,
      ...currentHistory.filter((keyword) => keyword !== normalizedKeyword),
    ]);
    setStreamStatus("searching");
    setStreamedResults([]);
    setCompletedSources(0);
    setTotalSources(0);
    setStreamError("");
    setFavoritedKeys(new Set());
    setPendingFavoriteKeys(new Set());
    setSearchRequestId((value) => value + 1);
  }

  async function deleteHistoryKeyword(keyword: string) {
    try {
      const response = await fetch(
        `/api/search/histories/${encodeURIComponent(keyword)}`,
        {
          headers: {
            Accept: "application/json",
          },
          method: "DELETE",
        },
      );

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as SearchHistoryApiResponse;

      setSearchHistory(readSearchHistoryFromApi(data));
    } catch {
      setSearchHistory((currentHistory) =>
        currentHistory.filter((currentKeyword) => currentKeyword !== keyword),
      );
    }
  }

  async function toggleFavorite(result: SearchResult) {
    if (pendingFavoriteKeys.has(result.favoriteKey)) {
      return;
    }

    const isFavorited = favoritedKeys.has(result.favoriteKey);
    setPendingFavoriteKeys((currentKeys) =>
      new Set(currentKeys).add(result.favoriteKey),
    );

    try {
      const response = isFavorited
        ? await fetch(
            `/api/favorites/${encodeURIComponent(result.resourceKey)}/${encodeURIComponent(result.resourceId)}`,
            {
              headers: { Accept: "application/json" },
              method: "DELETE",
            },
          )
        : await fetch(
            `/api/favorites/${encodeURIComponent(result.resourceKey)}/${encodeURIComponent(result.resourceId)}`,
            {
              headers: {
                Accept: "application/json",
              },
              method: "POST",
            },
          );

      if (!response.ok) {
        return;
      }

      setFavoritedKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys);

        if (isFavorited) {
          nextKeys.delete(result.favoriteKey);
        } else {
          nextKeys.add(result.favoriteKey);
        }

        return nextKeys;
      });
    } catch {
      // Keep the current local favorite state when the API call fails.
    } finally {
      setPendingFavoriteKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys);
        nextKeys.delete(result.favoriteKey);
        return nextKeys;
      });
    }
  }

  return (
    <section className="min-h-screen w-full px-4 py-6 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-400 content-start gap-8">
        <form
          className="mx-auto grid w-full max-w-4xl gap-4 md:mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-xl bg-surface/80 px-4 py-2 shadow-sm">
            {searchTypes.map((type) => {
              const Icon = type.Icon;

              return (
                <Button
                  className="shadow-none"
                  key={type.key}
                  aria-pressed={searchType === type.key}
                  type={searchType === type.key ? "primary" : "default"}
                  onClick={() => setSearchType(type.key)}
                  icon={<Icon />}
                >
                  {type.label}
                </Button>
              );
            })}
          </div>
          <label className="mx-auto grid w-full max-w-3xl">
            <span className="sr-only">搜索关键词</span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-2xl bg-surface shadow-sm transition focus-within:shadow-md">
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
                  onClick={clearSearch}
                >
                  <CloseCircleOutlined />
                </button>
              ) : null}
              <Button
                className="h-14 w-28"
                htmlType="submit"
                type="primary"
                icon={<SearchOutlined />}
              >
                搜索
              </Button>
            </span>
          </label>
        </form>

        <div className="grid gap-4">
          {hasSearched ? (
            <div className="grid gap-5">
              <div className="relative overflow-hidden rounded-xl bg-surface/80 p-4 shadow-sm md:p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/45 to-transparent" />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="flex min-w-0 flex-wrap items-end gap-2"
                      role="status"
                      aria-live="polite"
                    >
                      <h1 className="truncate text-2xl font-semibold tracking-normal text-foreground">
                        {activeQuery}
                      </h1>
                      {totalSources > 0 ? (
                        <span className="pb-0.5 text-xs text-default-400">
                          {isStreaming
                            ? `正在搜索 ${completedSources}/${totalSources}`
                            : `已完成 ${completedSources}/${totalSources}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Space.Compact>
                    {(["grid", "list"] as const).map((mode) => (
                      <Button
                        key={mode}
                        className="shadow-none"
                        aria-label={
                          mode === "grid" ? "切换为卡片视图" : "切换为列表视图"
                        }
                        aria-pressed={viewMode === mode}
                        size="small"
                        type={viewMode === mode ? "primary" : "default"}
                        onClick={() => setViewMode(mode)}
                      >
                        {mode === "grid" ? <TableOutlined /> : <BarsOutlined />}
                      </Button>
                    ))}
                  </Space.Compact>
                </div>
              </div>

              {streamError ? (
                <div
                  className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-red-500"
                  role="alert"
                >
                  <WarningOutlined />
                  <span>{streamError}</span>
                </div>
              ) : null}

              {visibleResults.length > 0 ? (
                <VirtualizedResults
                  favoritedKeys={favoritedKeys}
                  pendingFavoriteKeys={pendingFavoriteKeys}
                  resetKey={resultResetKey}
                  results={visibleResults}
                  viewMode={viewMode}
                  onToggleFavorite={toggleFavorite}
                />
              ) : isStreaming ? (
                <div
                  className="grid min-h-64 place-items-center rounded-lg border border-default-200 bg-surface/60 p-8 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <div className="grid justify-items-center gap-3">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-default-300 border-t-accent" />
                    <div>
                      <p className="font-medium text-foreground">
                        正在连接搜索源
                      </p>
                      <p className="mt-1 text-sm text-default-500">
                        首批结果马上显示。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-lg border border-default-200 bg-surface/60 p-8 text-center">
                  <div className="grid max-w-sm justify-items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-default-100 text-xl text-default-500">
                      <SearchOutlined />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">
                        没有符合筛选的结果
                      </p>
                      <p className="mt-1 text-sm text-default-500">
                        尝试切换分类、年份或重新搜索关键词。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && visibleResults.length > 0 ? (
                <div
                  className="sticky bottom-3 z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-default-200 bg-background/92 px-4 py-2 text-sm text-default-600 shadow-lg backdrop-blur"
                  role="status"
                  aria-live="polite"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-default-300 border-t-accent" />
                  正在搜索更多结果…
                </div>
              ) : null}
            </div>
          ) : (
            <SearchHistoryPanel
              keywords={searchHistory}
              onDelete={deleteHistoryKeyword}
              onSearch={runSearch}
            />
          )}
        </div>
      </div>
    </section>
  );
}
