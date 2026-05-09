"use client";

import Image from "next/image";
import type { ContentItem } from "../domain/content-types";

type ContentCardProps = {
  item: ContentItem;
  onClick?: () => void;
};

export function ContentCard({ item, onClick }: ContentCardProps) {
  return (
    <div
      className="flex-shrink-0 w-48 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-gray-800 transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
        <Image
          src={item.coverUrl}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
        />
        {item.rating && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-yellow-400 text-sm font-semibold">
            {item.rating.toFixed(1)}
          </div>
        )}
      </div>
      <h3 className="mt-2 text-white text-sm font-medium line-clamp-2">
        {item.title}
      </h3>
      {item.year && (
        <p className="text-gray-400 text-xs">{item.year}</p>
      )}
    </div>
  );
}
