"use client";

import {
  ClockCircleOutlined,
  DeleteOutlined,
  HeartFilled,
  HeartOutlined,
  PlayCircleFilled,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Progress, Tag } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { env } from "@/shared/env";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { HistoryItem } from "../server/history-service";

type HistoryRecord = HistoryItem & {
  is_favorite?: boolean;
};

interface HistoryApiResponse {
  history?: HistoryRecord[];
  message?: string;
}

type LoadState = "loading" | "ready" | "error";

function isHistoryItem(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const history = value as Partial<HistoryRecord>;

  return (
    typeof history.cover === "string" &&
    typeof history.douban_id === "number" &&
    typeof history.id === "string" &&
    typeof history.original_episodes === "number" &&
    typeof history.play_time === "number" &&
    typeof history.play_episodes === "number" &&
    typeof history.remarks === "string" &&
    typeof history.save_time === "number" &&
    typeof history.search_title === "string" &&
    typeof history.source === "string" &&
    typeof history.source_name === "string" &&
    typeof history.title === "string" &&
    typeof history.total_time === "number" &&
    typeof history.year === "string" &&
    (history.is_favorite === undefined ||
      typeof history.is_favorite === "boolean")
  );
}

function readHistoryFromApi(data: HistoryApiResponse) {
  if (!Array.isArray(data.history)) {
    return [];
  }

  return data.history.filter(isHistoryItem);
}

let historyLoadPromise: Promise<HistoryRecord[]> | null = null;

function loadHistory() {
  historyLoadPromise ??= fetch("/api/history", {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const data = (await response.json()) as HistoryApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "观看历史加载失败。");
      }

      return readHistoryFromApi(data);
    })
    .finally(() => {
      historyLoadPromise = null;
    });

  return historyLoadPromise;
}

function createPlayHref(history: HistoryItem) {
  const params = new URLSearchParams({
    source: history.source,
    id: history.id,
  });

  return `/play?${params.toString()}`;
}

function createHistoryResourceKey(history: HistoryItem) {
  return `${history.source}:${history.id}`;
}

function createProgressValue(history: HistoryItem) {
  if (!Number.isFinite(history.total_time) || history.total_time <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, (history.play_time / history.total_time) * 100),
  );
}

function HistoryPoster({
  history,
  isFavorite,
  isFavoriting,
  isRemoving,
  onFavoriteToggle,
  onRemove,
}: {
  history: HistoryItem;
  isFavorite: boolean;
  isFavoriting: boolean;
  isRemoving: boolean;
  onFavoriteToggle: (history: HistoryRecord) => void;
  onRemove: (history: HistoryItem) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const fallbackPosterUrl = createPlaceholderImageUrl({
    fileStem: history.title,
    seed: createHistoryResourceKey(history),
    variant: "poster",
  });

  return (
    <div className="relative grid w-full">
      <Link
        aria-label={`继续播放 ${history.title}`}
        className="relative block aspect-2/3 overflow-hidden bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        href={createPlayHref(history)}
        prefetch={false}
      >
        <Image
          alt={history.title}
          className="object-cover transition duration-700 group-hover:scale-[1.045] group-hover:saturate-110"
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
          src={imageError ? fallbackPosterUrl : history.cover}
          onError={() => setImageError(true)}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,transparent_34%,rgba(0,0,0,0.84)_100%)] opacity-85 transition-opacity group-hover:opacity-100" />
        <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/45 to-transparent" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-xl text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.32)] ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
          <PlayCircleFilled className="translate-x-px" />
        </span>
        <div className="absolute left-2.5 top-2.5 z-20 inline-flex overflow-hidden rounded-full shadow-sm ring-1 ring-white/20 backdrop-blur-md">
          <span className="bg-(--ant-red) px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
            EP.{history.play_episodes}
          </span>
          <span className="bg-white/14 px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
            /{history.original_episodes}
          </span>
        </div>
        {history.original_episodes > history.play_episodes ? (
          <Tag
            variant="solid"
            color="red"
            className="absolute! top-2.5 right-2.5"
          >
            +{history.original_episodes - history.play_episodes}
          </Tag>
        ) : null}
      </Link>
      <div className="absolute bottom-2.5 right-2.5 z-20 flex gap-1 opacity-0 transition duration-200 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={
            isFavorite ? `取消收藏 ${history.title}` : `收藏 ${history.title}`
          }
          aria-pressed={isFavorite}
          className={`grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed ${isFavorite ? "text-danger" : ""}`}
          disabled={isFavoriting}
          onClick={(event) => {
            event.stopPropagation();
            onFavoriteToggle(history);
          }}
        >
          {isFavorite ? (
            <HeartFilled className="text-danger" />
          ) : (
            <HeartOutlined />
          )}
        </button>
        <button
          type="button"
          aria-label={`移除观看记录 ${history.title}`}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed"
          disabled={isRemoving}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(history);
          }}
        >
          {isRemoving ? <SyncOutlined spin /> : <DeleteOutlined />}
        </button>
      </div>
    </div>
  );
}

function HistoryCard({
  history,
  isFavorite,
  isFavoriting,
  isRemoving,
  onFavoriteToggle,
  onRemove,
}: {
  history: HistoryRecord;
  isFavorite: boolean;
  isFavoriting: boolean;
  isRemoving: boolean;
  onFavoriteToggle: (history: HistoryRecord) => void;
  onRemove: (history: HistoryItem) => void;
}) {
  return (
    <article className="group grid w-full shrink-0 content-start overflow-hidden rounded-[1.15rem] bg-(--ant-color-bg-base)/78 text-left transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_6px_12px_rgba(15,23,42,0.14)]">
      <HistoryPoster
        history={history}
        isFavorite={isFavorite}
        isFavoriting={isFavoriting}
        isRemoving={isRemoving}
        onFavoriteToggle={onFavoriteToggle}
        onRemove={onRemove}
      />
      <Progress
        percent={createProgressValue(history)}
        showInfo={false}
        size={[0, 4]}
        status="exception"
      />
      <div className="grid gap-1.5 p-3.5">
        <Link
          aria-label={`继续播放 ${history.title}`}
          className="grid gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href={createPlayHref(history)}
          prefetch={false}
        >
          <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-(--ant-color-text-base) transition-colors group-hover:text-accent">
            {history.title}
          </h2>
          <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted">
            <span className="min-w-0 truncate text-(--ant-color-text-base)/80">
              {history.year || "未知年份"}
            </span>
            <span className="min-w-0 truncate text-right text-(--ant-color-text-base)/80">
              {history.source_name}
            </span>
          </div>
        </Link>
      </div>
    </article>
  );
}

function HistoryEmptyState() {
  return (
    <div className="grid min-h-88 place-items-center rounded-md border border-dashed border-foreground/16 bg-surface/54 px-6 text-center">
      <div className="grid max-w-md gap-4">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/12 text-2xl text-accent">
          <ClockCircleOutlined />
        </span>
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            还没有观看历史
          </h2>
          <p className="text-sm leading-6 text-muted">
            观看并记录一集后，影片会出现在这里，方便你随时继续播放。
          </p>
        </div>
        <Link
          className="mx-auto inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          href="/search"
          prefetch={false}
        >
          <SearchOutlined />
          去搜索
        </Link>
      </div>
    </div>
  );
}

export function HistoryPageShell() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [favoritingKeys, setFavoritingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    void loadHistory()
      .then((loadedHistory) => {
        if (isMounted) {
          setHistory(loadedHistory);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadState("error");
          setErrorMessage(
            error instanceof Error ? error.message : "观看历史加载失败。",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function removeHistoryItem(item: HistoryItem) {
    const historyKey = createHistoryResourceKey(item);

    if (removingKeys.has(historyKey)) {
      return;
    }

    setRemovingKeys((currentKeys) => new Set(currentKeys).add(historyKey));
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/history/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}`,
        {
          headers: { Accept: "application/json" },
          method: "DELETE",
        },
      );
      const data = (await response.json()) as HistoryApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "移除观看记录失败。");
      }

      setHistory(readHistoryFromApi(data));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "移除观看记录失败。",
      );
    } finally {
      setRemovingKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys);
        nextKeys.delete(historyKey);
        return nextKeys;
      });
    }
  }

  async function toggleFavoriteItem(item: HistoryRecord) {
    const favoriteKey = createHistoryResourceKey(item);

    if (favoritingKeys.has(favoriteKey)) {
      return;
    }

    setFavoritingKeys((currentKeys) => new Set(currentKeys).add(favoriteKey));
    setErrorMessage("");

    const isFavorite = item.is_favorite === true;

    try {
      const response = await fetch(
        `/api/favorites/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}`,
        {
          headers: { Accept: "application/json" },
          method: isFavorite ? "DELETE" : "POST",
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "收藏操作失败。");
      }

      setHistory((currentHistory) =>
        currentHistory.map((historyItem) =>
          createHistoryResourceKey(historyItem) === favoriteKey
            ? { ...historyItem, is_favorite: !isFavorite }
            : historyItem,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "收藏操作失败。",
      );
    } finally {
      setFavoritingKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys);
        nextKeys.delete(favoriteKey);
        return nextKeys;
      });
    }
  }

  return (
    <section className="min-h-screen w-full px-4 py-8 text-foreground md:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl content-start gap-8">
        <header className="grid gap-5">
          <div className="grid gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-accent">
              <ClockCircleOutlined />
              {env.NEXT_PUBLIC_SITE_NAME}
            </p>
            <div className="grid gap-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                观看历史
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted md:text-base">
                最近播放过的影片会按时间倒序展示，方便你继续播放或移除记录。
              </p>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="flex items-center gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            <WarningOutlined />
            <span>{errorMessage}</span>
          </div>
        )}

        {loadState === "loading" && (
          <div className="grid min-h-88 place-items-center rounded-md bg-surface/54 text-muted">
            <div className="inline-flex items-center gap-3 text-sm">
              <SyncOutlined className="animate-spin" />
              正在加载观看历史
            </div>
          </div>
        )}

        {loadState === "error" && (
          <div className="grid min-h-88 place-items-center rounded-md bg-surface/54 px-6 text-center">
            <div className="grid max-w-md gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                观看历史暂时不可用
              </h2>
              <p className="text-sm leading-6 text-muted">
                请稍后刷新页面重试。
              </p>
            </div>
          </div>
        )}

        {loadState === "ready" && history.length === 0 && <HistoryEmptyState />}

        {loadState === "ready" && history.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {history.map((item) => (
              <HistoryCard
                key={createHistoryResourceKey(item)}
                history={item}
                isFavorite={item.is_favorite === true}
                isFavoriting={favoritingKeys.has(
                  createHistoryResourceKey(item),
                )}
                isRemoving={removingKeys.has(createHistoryResourceKey(item))}
                onFavoriteToggle={toggleFavoriteItem}
                onRemove={removeHistoryItem}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
