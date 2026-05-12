"use client";

import { useState } from "react";
import type { HomepageData } from "../application/homepage-service";
import { WelcomeBanner } from "./welcome-banner";
import { LoadingOverlay } from "./loading-overlay";
import { HeroBanner } from "./hero-banner";
import { ContentCarousel } from "./content-carousel";

type HomepageShellProps = {
  data: HomepageData;
  userName?: string;
};

export function HomepageShell({ data, userName }: HomepageShellProps) {
  const [isLoading] = useState(false);
  const [sections, setSections] = useState(data.sections);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

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
