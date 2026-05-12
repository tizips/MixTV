"use client";

import Link from "next/link";
import type { ContentItem } from "../domain/content-types";
import { ContentCard } from "./content-card";

type ContentCarouselProps = {
  title: string;
  icon: string;
  iconClass: string;
  items: ContentItem[];
  moreLink?: string;
  variant?: "default" | "continueWatching";
  favoriteIds?: Set<string>;
  onFavorite?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
};

export function ContentCarousel({
  title,
  icon,
  iconClass,
  items,
  moreLink,
  variant = "default",
  favoriteIds,
  onFavorite,
  onDelete,
}: ContentCarouselProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-foreground">
          <i aria-hidden="true" className={`bi ${icon} text-[1.15em] ${iconClass}`} />
          <span>{title}</span>
        </h2>
        {moreLink && (
          <Link
            href={moreLink}
            className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
          >
            <span>查看更多</span>
            <i
              aria-hidden="true"
              className="bi bi-chevron-right text-[0.95em]"
              style={{ WebkitTextStroke: "0.7px currentColor" }}
            />
          </Link>
        )}
      </div>
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            variant={variant}
            isFavorite={favoriteIds?.has(item.id)}
            onFavorite={onFavorite ? () => onFavorite(item.id) : undefined}
            onDelete={onDelete ? () => onDelete(item.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
