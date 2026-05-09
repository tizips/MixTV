"use client";

import Link from "next/link";
import type { ContentItem } from "../domain/content-types";
import { ContentCard } from "./content-card";

type ContentCarouselProps = {
  title: string;
  items: ContentItem[];
  moreLink?: string;
};

export function ContentCarousel({ title, items, moreLink }: ContentCarouselProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-2xl font-bold">{title}</h2>
        {moreLink && (
          <Link
            href={moreLink}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            查看更多 →
          </Link>
        )}
      </div>
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
