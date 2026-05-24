"use client";

import {
  CalendarFilled,
  LaptopOutlined,
  MobileFilled,
  PlayCircleFilled,
  PlaySquareFilled,
  RightOutlined,
  StarFilled,
  VideoCameraOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import type { ContentItem } from "../domain/content-types";
import type { HomepageSectionIcon } from "../application/homepage-service";
import { ContentCard } from "./content-card";

type ContentCarouselProps = {
  title: string;
  icon: HomepageSectionIcon;
  iconClass: string;
  items: ContentItem[];
  moreLink?: string;
  variant?: "default" | "continueWatching";
  favoriteIds?: Set<string>;
  deletingIds?: Set<string>;
  favoritingIds?: Set<string>;
  onFavorite?: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
};

const sectionIconMap = {
  "calendar-event-fill": CalendarFilled,
  film: VideoCameraOutlined,
  "phone-fill": MobileFilled,
  "play-btn-fill": PlaySquareFilled,
  "play-circle-fill": PlayCircleFilled,
  stars: StarFilled,
  "tv-fill": LaptopOutlined,
} satisfies Record<HomepageSectionIcon, typeof PlayCircleFilled>;

export function ContentCarousel({
  title,
  icon,
  iconClass,
  items,
  moreLink,
  variant = "default",
  favoriteIds,
  deletingIds,
  favoritingIds,
  onFavorite,
  onDelete,
}: ContentCarouselProps) {
  const Icon = sectionIconMap[icon];

  return (
    <section className="pb-8">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-foreground">
          <Icon className={`text-[1.15em] ${iconClass}`} />
          <span>{title}</span>
        </h2>
        {moreLink && (
          <Link
            href={moreLink}
            className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
            prefetch={false}
          >
            <span>查看更多</span>
            <RightOutlined className="text-[0.95em]" />
          </Link>
        )}
      </div>
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pt-4 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            variant={variant}
            isFavorite={favoriteIds?.has(item.id)}
            isDeleting={deletingIds?.has(item.id)}
            isFavoriting={favoritingIds?.has(item.id)}
            onFavorite={onFavorite ? () => onFavorite(item) : undefined}
            onDelete={onDelete ? () => onDelete(item) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
