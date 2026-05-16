"use client";

import { useEffect, useState } from "react";
import type { HomepageData } from "../application/homepage-service";
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
  index: number;
  is_favorite?: boolean;
  original_episodes: number;
  source: string;
  source_name: string;
  title: string;
  total_episodes: number;
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
    typeof history.index === "number" &&
    typeof history.original_episodes === "number" &&
    typeof history.source === "string" &&
    typeof history.source_name === "string" &&
    typeof history.title === "string" &&
    typeof history.total_episodes === "number" &&
    typeof history.year === "string" &&
    (history.is_favorite === undefined || typeof history.is_favorite === "boolean")
  );
}

function readHistoryFromApi(data: HistoryApiResponse) {
  if (!Array.isArray(data.history)) {
    return [];
  }

  return data.history.filter(isHistoryApiItem);
}

export function createContinueWatchingItem(history: HistoryApiItem) {
  const year = Number(history.year);

  return {
    coverUrl: history.cover,
    continueWatching: {
      currentEpisode: history.index,
      latestEpisode: history.total_episodes,
      sourceName: history.source_name,
    },
    id: history.id,
    title: history.title,
    type: history.total_episodes > 1 ? ("tv" as const) : ("movie" as const),
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

  useEffect(() => {
    let isActive = true;

    const continueWatchingSection = data.sections.find((section) => section.key === "continueWatching");

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
        const nextFavorites = new Set(history.filter((item) => item.is_favorite).map((item) => item.id));

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

  const toggleFavorite = (itemId: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });
  };

  const deleteContinueWatchingItem = (itemId: string) => {
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.key === "continueWatching"
          ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
          : section,
      ),
    );
    setFavoriteIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  return (
    <div className="min-h-screen p-4 text-foreground md:p-6 lg:p-12">
      <LoadingOverlay isLoading={isLoading} />

      {data.showWelcomeBanner ? <WelcomeBanner userName={userName} /> : null}

      {data.heroBanner.length > 0 && (
        <HeroBanner items={data.heroBanner} />
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <ContentCarousel
            key={section.key}
            title={section.title}
            icon={section.icon}
            iconClass={section.iconClass}
            items={section.items}
            moreLink={section.moreLink}
            variant={section.key === "continueWatching" ? "continueWatching" : "default"}
            favoriteIds={favoriteIds}
            onFavorite={section.key === "continueWatching" ? toggleFavorite : undefined}
            onDelete={section.key === "continueWatching" ? deleteContinueWatchingItem : undefined}
          />
        ))}
      </div>
    </div>
  );
}
