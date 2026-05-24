"use client";

import {
  HeartFilled,
  HeartOutlined,
  PlayCircleFilled,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { env } from "@/shared/env";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { FavoriteItem } from "../server/favorite-service";

interface FavoritesApiResponse {
  favorites?: FavoriteItem[];
  message?: string;
}

type LoadState = "loading" | "ready" | "error";

function isFavoriteItem(value: unknown): value is FavoriteItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const favorite = value as Partial<FavoriteItem>;

  return (
    typeof favorite.cover === "string" &&
    typeof favorite.douban_id === "number" &&
    typeof favorite.id === "string" &&
    typeof favorite.original_episodes === "number" &&
    typeof favorite.remarks === "string" &&
    typeof favorite.save_time === "number" &&
    typeof favorite.search_title === "string" &&
    typeof favorite.source === "string" &&
    typeof favorite.source_name === "string" &&
    typeof favorite.title === "string" &&
    typeof favorite.year === "string"
  );
}

function readFavoritesFromApi(data: FavoritesApiResponse) {
  if (!Array.isArray(data.favorites)) {
    return [];
  }

  return data.favorites.filter(isFavoriteItem);
}

let favoritesLoadPromise: Promise<FavoriteItem[]> | null = null;

function loadFavorites() {
  favoritesLoadPromise ??= fetch("/api/favorites", {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const data = (await response.json()) as FavoritesApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "收藏加载失败。");
      }

      return readFavoritesFromApi(data);
    })
    .finally(() => {
      favoritesLoadPromise = null;
    });

  return favoritesLoadPromise;
}

function createPlayHref(favorite: FavoriteItem) {
  const params = new URLSearchParams({
    source: favorite.source,
    id: favorite.id,
  });

  return `/play?${params.toString()}`;
}

function FavoritePoster({
  favorite,
  isRemoving,
  onRemove,
}: {
  favorite: FavoriteItem;
  isRemoving: boolean;
  onRemove: (favorite: FavoriteItem) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const favoriteKey = createFavoriteResourceKey(favorite);
  const fallbackPosterUrl = createPlaceholderImageUrl({
    fileStem: favorite.title,
    seed: favoriteKey,
    variant: "poster",
  });

  return (
    <div className="relative grid w-full">
      <Link
        aria-label={`播放 ${favorite.title}`}
        className="relative block aspect-2/3 overflow-hidden bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        href={createPlayHref(favorite)}
        prefetch={false}
      >
        <Image
          alt={favorite.title}
          className="object-cover transition duration-700 group-hover:scale-[1.045] group-hover:saturate-110"
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
          src={imageError ? fallbackPosterUrl : favorite.cover}
          onError={() => setImageError(true)}
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/85 opacity-85 transition-opacity group-hover:opacity-100" />
        <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/45 to-transparent" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-xl text-white opacity-0 shadow-lg ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
          <PlayCircleFilled className="translate-x-px" />
        </span>
      </Link>
      <div className="absolute bottom-2.5 right-2.5 z-20 flex gap-1 opacity-0 transition duration-200 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={`取消收藏 ${favorite.title}`}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed"
          disabled={isRemoving}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(favorite);
          }}
        >
          {isRemoving ? (
            <SyncOutlined spin />
          ) : (
            <HeartFilled className="text-red-500" />
          )}
        </button>
      </div>
    </div>
  );
}

function FavoriteCard({
  favorite,
  isRemoving,
  onRemove,
}: {
  favorite: FavoriteItem;
  isRemoving: boolean;
  onRemove: (favorite: FavoriteItem) => void;
}) {
  return (
    <article className="group grid w-full shrink-0 content-start overflow-hidden rounded-xl bg-surface/80 text-left transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-md">
      <FavoritePoster
        favorite={favorite}
        isRemoving={isRemoving}
        onRemove={onRemove}
      />
      <div className="grid gap-1.5 p-3.5">
        <Link
          aria-label={`播放 ${favorite.title}`}
          className="grid gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href={createPlayHref(favorite)}
          prefetch={false}
        >
          <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
            {favorite.title}
          </h2>
          <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-foreground/80">
            <span className="min-w-0 truncate">
              {favorite.year || "未知年份"}
            </span>
            <span className="min-w-0 truncate text-right text-foreground/80">
              {favorite.source_name}
            </span>
          </div>
        </Link>
      </div>
    </article>
  );
}

function createFavoriteResourceKey(favorite: FavoriteItem) {
  return `${favorite.source}:${favorite.id}`;
}

function FavoritesEmptyState() {
  return (
    <div className="grid min-h-88 place-items-center rounded-md border border-dashed border-foreground/16 bg-surface/54 px-6 text-center">
      <div className="grid max-w-md gap-4">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/12 text-2xl text-accent">
          <HeartOutlined />
        </span>
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            还没有收藏内容
          </h2>
          <p className="text-sm leading-6 text-muted">
            从搜索结果里点亮爱心后，影片会出现在这里，方便下次继续播放。
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

export function FavoritesPageShell() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    void loadFavorites()
      .then((loadedFavorites) => {
        if (isMounted) {
          setFavorites(loadedFavorites);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadState("error");
          setErrorMessage(
            error instanceof Error ? error.message : "收藏加载失败。",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function removeFavorite(favorite: FavoriteItem) {
    const favoriteKey = createFavoriteResourceKey(favorite);

    if (removingKeys.has(favoriteKey)) {
      return;
    }

    setRemovingKeys((currentKeys) => new Set(currentKeys).add(favoriteKey));
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/favorites/${encodeURIComponent(favorite.source)}/${encodeURIComponent(favorite.id)}`,
        {
          headers: { Accept: "application/json" },
          method: "DELETE",
        },
      );
      const data = (await response.json()) as FavoritesApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "取消收藏失败。");
      }

      setFavorites(readFavoritesFromApi(data));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "取消收藏失败。",
      );
    } finally {
      setRemovingKeys((currentKeys) => {
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
              <HeartOutlined />
              {env.NEXT_PUBLIC_SITE_NAME}
            </p>
            <div className="grid gap-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                我的收藏
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted md:text-base">
                保存常看的剧集和电影，按最近更新顺序快速回到播放入口。
              </p>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="flex items-center gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-red-500">
            <WarningOutlined />
            <span>{errorMessage}</span>
          </div>
        )}

        {loadState === "loading" && (
          <div className="grid min-h-88 place-items-center rounded-md bg-surface/54 text-muted">
            <div className="inline-flex items-center gap-3 text-sm">
              <SyncOutlined className="animate-spin" />
              正在加载收藏
            </div>
          </div>
        )}

        {loadState === "error" && (
          <div className="grid min-h-88 place-items-center rounded-md bg-surface/54 px-6 text-center">
            <div className="grid max-w-md gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                收藏暂时不可用
              </h2>
              <p className="text-sm leading-6 text-muted">
                请稍后刷新页面重试。
              </p>
            </div>
          </div>
        )}

        {loadState === "ready" && favorites.length === 0 && (
          <FavoritesEmptyState />
        )}

        {loadState === "ready" && favorites.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {favorites.map((favorite) => (
              <FavoriteCard
                key={createFavoriteResourceKey(favorite)}
                favorite={favorite}
                isRemoving={removingKeys.has(
                  createFavoriteResourceKey(favorite),
                )}
                onRemove={removeFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
