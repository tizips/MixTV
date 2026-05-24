"use client";

import { WarningOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { HomepageData } from "../application/homepage-service";
import type { ContentItem } from "../domain/content-types";
import { WelcomeBanner } from "./welcome-banner";
import { LoadingOverlay } from "./loading-overlay";
import { HeroBanner } from "./hero-banner";
import { ContentCarousel } from "./content-carousel";

type HomepageShellProps = {
  data: HomepageData;
  userName?: string;
};

type HistoryApiItem = {
  cover: string;
  id: string;
  is_favorite?: boolean;
  original_episodes: number;
  play_episodes: number;
  source: string;
  source_name: string;
  title: string;
  year: string;
};

type HistoryApiResponse = {
  history?: HistoryApiItem[];
  message?: string;
};

let continueWatchingLoadPromise: Promise<HistoryApiItem[]> | null = null;

function isHistoryApiItem(value: unknown): value is HistoryApiItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const history = value as Partial<HistoryApiItem>;

  return (
    typeof history.cover === "string" &&
    typeof history.id === "string" &&
    typeof history.original_episodes === "number" &&
    typeof history.play_episodes === "number" &&
    typeof history.source === "string" &&
    typeof history.source_name === "string" &&
    typeof history.title === "string" &&
    typeof history.year === "string" &&
    (history.is_favorite === undefined ||
      typeof history.is_favorite === "boolean")
  );
}

function readHistoryFromApi(data: HistoryApiResponse) {
  if (!Array.isArray(data.history)) {
    return [];
  }

  return data.history.filter(isHistoryApiItem);
}

function createHistoryResourceKey(source: string, id: string) {
  return `${source}:${id}`;
}

function createHistoryApiResourceKey(item: HistoryApiItem) {
  return createHistoryResourceKey(item.source, item.id);
}

function createContentResourceKey(item: ContentItem) {
  return createHistoryResourceKey(item.continueWatching?.source ?? "", item.id);
}

export function createContinueWatchingItem(history: HistoryApiItem) {
  const year = Number(history.year);

  return {
    coverUrl: history.cover,
    continueWatching: {
      currentEpisode: history.play_episodes,
      latestEpisode: history.original_episodes,
      sourceName: history.source_name,
      source: history.source,
    },
    id: history.id,
    title: history.title,
    type: history.original_episodes > 1 ? ("tv" as const) : ("movie" as const),
    year: Number.isFinite(year) ? year : undefined,
  };
}

export function loadContinueWatching() {
  continueWatchingLoadPromise ??= fetch("/api/history", {
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
      continueWatchingLoadPromise = null;
    });

  return continueWatchingLoadPromise;
}

export function HomepageShell({ data, userName }: HomepageShellProps) {
  const [isLoading] = useState(false);
  const [sections, setSections] = useState(data.sections);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoritingIds, setFavoritingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    const continueWatchingSection = data.sections.find(
      (section) => section.key === "continueWatching",
    );

    if (!continueWatchingSection) {
      return () => {
        isActive = false;
      };
    }

    loadContinueWatching()
      .then((history) => {
        if (!isActive) {
          return;
        }

        const nextItems = history.map(createContinueWatchingItem);
        const nextFavorites = new Set(
          history
            .filter((item) => item.is_favorite)
            .map(createHistoryApiResourceKey),
        );

        setSections((currentSections) =>
          currentSections.map((section) =>
            section.key === "continueWatching"
              ? { ...section, items: nextItems }
              : section,
          ),
        );
        setFavoriteIds(nextFavorites);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
      });

    return () => {
      isActive = false;
    };
  }, [data.sections]);

  const toggleFavorite = async (item: ContentItem) => {
    const source = item.continueWatching?.source;

    if (!source) {
      return;
    }

    const favoriteKey = createContentResourceKey(item);

    if (favoritingIds.has(favoriteKey)) {
      return;
    }

    setFavoritingIds((current) => new Set(current).add(favoriteKey));
    setErrorMessage("");

    const isFavorite = favoriteIds.has(favoriteKey);

    try {
      const response = await fetch(
        `/api/favorites/${encodeURIComponent(source)}/${encodeURIComponent(item.id)}`,
        {
          headers: { Accept: "application/json" },
          method: isFavorite ? "DELETE" : "POST",
        },
      );
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "收藏操作失败。");
      }

      setFavoriteIds((current) => {
        const next = new Set(current);

        if (isFavorite) {
          next.delete(favoriteKey);
        } else {
          next.add(favoriteKey);
        }

        return next;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "收藏操作失败。",
      );
    } finally {
      setFavoritingIds((current) => {
        const next = new Set(current);
        next.delete(favoriteKey);
        return next;
      });
    }
  };

  const deleteContinueWatchingItem = async (item: ContentItem) => {
    const source = item.continueWatching?.source;

    if (!source) {
      return;
    }

    const historyKey = createContentResourceKey(item);

    if (deletingIds.has(historyKey)) {
      return;
    }

    setDeletingIds((current) => new Set(current).add(historyKey));
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/history/${encodeURIComponent(source)}/${encodeURIComponent(item.id)}`,
        {
          headers: { Accept: "application/json" },
          method: "DELETE",
        },
      );
      const result = (await response.json()) as HistoryApiResponse;

      if (!response.ok) {
        throw new Error(result.message || "移除观看记录失败。");
      }

      const nextHistory = readHistoryFromApi(result);
      const nextItems = nextHistory.map(createContinueWatchingItem);
      const nextFavorites = new Set(
        nextHistory
          .filter((historyItem) => historyItem.is_favorite)
          .map(createHistoryApiResourceKey),
      );

      setSections((currentSections) =>
        currentSections.map((section) =>
          section.key === "continueWatching"
            ? { ...section, items: nextItems }
            : section,
        ),
      );
      setFavoriteIds(nextFavorites);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "移除观看记录失败。",
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(historyKey);
        return next;
      });
    }
  };

  const favoriteItemIds = new Set(
    sections
      .flatMap((section) => section.items)
      .filter((item) => favoriteIds.has(createContentResourceKey(item)))
      .map((item) => item.id),
  );
  const favoritingItemIds = new Set(
    sections
      .flatMap((section) => section.items)
      .filter((item) => favoritingIds.has(createContentResourceKey(item)))
      .map((item) => item.id),
  );
  const deletingItemIds = new Set(
    sections
      .flatMap((section) => section.items)
      .filter((item) => deletingIds.has(createContentResourceKey(item)))
      .map((item) => item.id),
  );

  return (
    <div className="min-h-screen p-4 text-foreground md:p-6 lg:p-12">
      <LoadingOverlay isLoading={isLoading} />

      {data.showWelcomeBanner ? <WelcomeBanner userName={userName} /> : null}

      {data.heroBanner.length > 0 && <HeroBanner items={data.heroBanner} />}

      {errorMessage && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-red-500">
          <WarningOutlined />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) =>
          section.items.length > 0 ? (
            <ContentCarousel
              key={section.key}
              title={section.title}
              icon={section.icon}
              iconClass={section.iconClass}
              items={section.items}
              moreLink={section.moreLink}
              variant={
                section.key === "continueWatching"
                  ? "continueWatching"
                  : "default"
              }
              favoriteIds={favoriteItemIds}
              favoritingIds={favoritingItemIds}
              deletingIds={deletingItemIds}
              onFavorite={
                section.key === "continueWatching" ? toggleFavorite : undefined
              }
              onDelete={
                section.key === "continueWatching"
                  ? deleteContinueWatchingItem
                  : undefined
              }
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
