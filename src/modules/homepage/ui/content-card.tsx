"use client";

import { useState } from "react";
import Image from "next/image";
import type { ContentItem } from "../domain/content-types";

type ContentCardProps = {
  item: ContentItem;
  variant?: "default" | "continueWatching";
  isFavorite?: boolean;
  onClick?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
};

const FALLBACK_COVER = "https://ts1.tc.mm.bing.net/th?id=OHR.SkradinskiBuk_ZH-CN0882603359_3840x2160.avif";

export function ContentCard({ item, variant = "default", isFavorite = false, onClick, onFavorite, onDelete }: ContentCardProps) {
  const [imageError, setImageError] = useState(false);
  const progress = item.continueWatching;
  const isContinueWatching = variant === "continueWatching" && Boolean(progress);
  const extraEpisodes = progress
    ? Math.max(progress.latestEpisode - progress.currentEpisode, 0)
    : 0;

  return (
    <div className="group w-48 flex-shrink-0" onClick={onClick}>
      <div className="relative">
        {isContinueWatching && progress && (
          <div className="absolute right-1.5 top-1.5 z-20 rounded-full bg-danger px-3 py-1.5 text-sm font-semibold leading-none text-danger-foreground shadow-lg backdrop-blur-sm">
            +{extraEpisodes}
          </div>
        )}
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-secondary transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
          <Image
            src={imageError ? FALLBACK_COVER : item.coverUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
            onError={() => setImageError(true)}
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
            <i
              aria-hidden="true"
              className="bi bi-play-circle text-[2.75rem] leading-none text-accent-foreground transition-transform duration-300 drop-shadow-[0_8px_14px_color-mix(in_srgb,var(--accent)_42%,transparent)] group-hover:scale-[1.03]"
            />
          </div>
          {isContinueWatching && progress && (
            <>
              <div className="absolute left-2 top-2 z-10 inline-flex overflow-hidden rounded-full shadow-sm backdrop-blur-sm">
                <span className="bg-danger px-3 py-1 text-xs font-semibold leading-none text-danger-foreground">
                  EP.{progress.currentEpisode}
                </span>
                <span className="bg-default px-3 py-1 text-xs font-semibold leading-none text-default-foreground">
                  {progress.latestEpisode}
                </span>
              </div>
              <div className="absolute bottom-2 right-2 z-10 flex gap-1">
                <button
                  type="button"
                  aria-label={isFavorite ? "取消收藏" : "收藏"}
                  aria-pressed={isFavorite}
                  className={`inline-flex h-10 w-10 items-center justify-center text-accent-foreground transition-colors hover:text-danger ${isFavorite ? "text-danger" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFavorite?.();
                  }}
                >
                  <i
                    aria-hidden="true"
                    className={`bi ${isFavorite ? "bi-heart-fill" : "bi-heart"} text-[1.15rem]`}
                  />
                </button>
                <button
                  type="button"
                  aria-label="删除"
                  className="inline-flex h-10 w-10 items-center justify-center text-accent-foreground transition-colors hover:text-danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete?.();
                  }}
                >
                  <i aria-hidden="true" className="bi bi-trash text-[1.15rem]" />
                </button>
              </div>
            </>
          )}
          {item.rating && !isContinueWatching && (
            <div className="absolute top-2 right-2 rounded bg-surface-secondary/80 px-2 py-1 text-sm font-semibold text-accent backdrop-blur-sm">
              {item.rating.toFixed(1)}
            </div>
          )}
        </div>
      </div>
      {isContinueWatching ? (
        <>
          <h3 className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
            {item.title}
          </h3>
          <div className="mt-2 flex items-end justify-between gap-3 text-xs text-muted">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {item.year && <span>{item.year}</span>}
                {progress && <span className="truncate text-foreground/80">{progress.sourceName}</span>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
            {item.title}
          </h3>
          {item.year && <p className="text-xs text-muted">{item.year}</p>}
        </>
      )}
    </div>
  );
}
