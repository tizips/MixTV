"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { ContentItem } from "../domain/content-types";

type ContentCardProps = {
  item: ContentItem;
  variant?: "default" | "continueWatching";
  isFavorite?: boolean;
  onClick?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
};

export function ContentCard({ item, variant = "default", isFavorite = false, onClick, onFavorite, onDelete }: ContentCardProps) {
  const [imageError, setImageError] = useState(false);
  const progress = item.continueWatching;
  const isContinueWatching = variant === "continueWatching" && Boolean(progress);
  const extraEpisodes = progress
    ? Math.max(progress.latestEpisode - progress.currentEpisode, 0)
    : 0;
  const fallbackCoverUrl = createPlaceholderImageUrl({
    variant: "poster",
    fileStem: item.title,
    seed: item.id,
  });

  return (
    <article className="group grid w-48 flex-shrink-0 content-start overflow-hidden rounded-[1.15rem] bg-surface/78 text-left transition duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_6px_12px_rgba(15,23,42,0.14)]">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-secondary">
        <Link
          aria-label={`播放 ${item.title}`}
          className="relative block h-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href="/play"
          onClick={onClick}
        >
          <Image
            src={imageError ? fallbackCoverUrl : item.coverUrl}
            alt={item.title}
            fill
            className="object-cover transition duration-700 group-hover:scale-[1.045] group-hover:saturate-110"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,transparent_34%,rgba(0,0,0,0.84)_100%)] opacity-85 transition-opacity group-hover:opacity-100" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-xl text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.32)] ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
            <i aria-hidden="true" className="bi bi-play-fill translate-x-px" />
          </span>
          {isContinueWatching && progress && (
            <>
              <div className="absolute left-2.5 top-2.5 z-10 inline-flex overflow-hidden rounded-full shadow-sm ring-1 ring-white/20 backdrop-blur-md">
                <span className="bg-danger px-2.5 py-1 text-[11px] font-semibold leading-none text-danger-foreground">
                  EP.{progress.currentEpisode}
                </span>
                <span className="bg-white/14 px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
                  {progress.latestEpisode}
                </span>
              </div>
              {extraEpisodes > 0 && (
                <Chip
                  className="absolute right-2.5 top-2.5 z-10 h-6 rounded-full bg-danger px-2.5 text-[11px] font-semibold text-danger-foreground shadow-lg ring-1 ring-white/20 backdrop-blur-md"
                  color="danger"
                  size="sm"
                  variant="primary"
                >
                  +{extraEpisodes}
                </Chip>
              )}
            </>
          )}
          {item.rating && !isContinueWatching && (
            <Chip
              className="absolute right-2.5 top-2.5 z-10 h-6 rounded-full bg-white/14 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md"
              size="sm"
              variant="soft"
            >
              {item.rating.toFixed(1)}
            </Chip>
          )}
        </Link>
        {isContinueWatching && progress && (
          <div className="absolute bottom-2.5 right-2.5 z-20 flex gap-1 opacity-0 transition duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              aria-label={isFavorite ? "取消收藏" : "收藏"}
              aria-pressed={isFavorite}
              className={`grid h-7 w-7 place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger ${isFavorite ? "text-danger" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onFavorite?.();
              }}
            >
              <i
                aria-hidden="true"
                className={`bi ${isFavorite ? "bi-heart-fill" : "bi-heart"}`}
              />
            </button>
            <button
              type="button"
              aria-label="删除"
              className="grid h-7 w-7 place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
            >
              <i aria-hidden="true" className="bi bi-trash" />
            </button>
          </div>
        )}
      </div>
      <Link
        aria-label={`播放 ${item.title}`}
        className="grid gap-1.5 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        href="/play"
        onClick={onClick}
      >
        {isContinueWatching ? (
          <>
            <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
              {item.title}
            </h3>
            <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted">
              {item.year && <span>{item.year}</span>}
              {progress && <span className="truncate text-foreground/80">{progress.sourceName}</span>}
            </div>
          </>
        ) : (
          <>
            <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">
              {item.title}
            </h3>
            {item.year && <p className="text-xs text-muted">{item.year}</p>}
          </>
        )}
      </Link>
    </article>
  );
}
