"use client";

import {
  DeleteOutlined,
  HeartFilled,
  HeartOutlined,
  PlayCircleFilled,
} from "@ant-design/icons";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Tag } from "antd";
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

function createPlayHref(
  item: ContentItem,
  variant: "default" | "continueWatching",
) {
  if (variant !== "continueWatching" || !item.continueWatching?.source) {
    return "/play";
  }

  const params = new URLSearchParams({
    id: item.id,
    source: item.continueWatching.source,
  });

  return `/play?${params.toString()}`;
}

export function ContentCard({
  item,
  variant = "default",
  isFavorite = false,
  onClick,
  onFavorite,
  onDelete,
}: ContentCardProps) {
  const [imageError, setImageError] = useState(false);
  const progress = item.continueWatching;
  const isContinueWatching =
    variant === "continueWatching" && Boolean(progress);
  const extraEpisodes = progress
    ? Math.max(progress.latestEpisode - progress.currentEpisode, 0)
    : 0;
  const fallbackCoverUrl = createPlaceholderImageUrl({
    variant: "poster",
    fileStem: item.title,
    seed: item.id,
  });

  return (
    <article className="group grid w-48 shrink-0 content-start overflow-hidden rounded-[1.15rem]  bg-(--ant-color-bg-container)/75 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_6px_12px_rgba(15,23,42,0.14)]">
      <div className="relative aspect-2/3 overflow-hidden)]">
        <Link
          aria-label={`播放 ${item.title}`}
          className="relative block h-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          href={createPlayHref(item, variant)}
          prefetch={false}
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
          <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/45 to-transparent" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-xl text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.32)] ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-105 group-hover:opacity-100">
            <PlayCircleFilled className="translate-x-px" />
          </span>
          {isContinueWatching && progress && (
            <>
              <div className="absolute left-2.5 top-2.5 z-10 inline-flex overflow-hidden rounded-full shadow-sm ring-1 ring-white/20 backdrop-blur-md">
                <span className="bg-(--ant-red) px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
                  EP.{progress.currentEpisode}
                </span>
                <span className="bg-white/14 px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
                  {progress.latestEpisode}
                </span>
              </div>
              {extraEpisodes > 0 && (
                <Tag
                  color="red"
                  variant="solid"
                  className="absolute! top-2.5 right-2.5"
                >
                  +{extraEpisodes}
                </Tag>
              )}
            </>
          )}
          {item.rating && !isContinueWatching && (
            <Tag color="default">{item.rating.toFixed(1)}</Tag>
          )}
        </Link>
        {isContinueWatching && (
          <div className="absolute bottom-2.5 right-2.5 z-20 flex gap-1 opacity-0 transition duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              aria-label={isFavorite ? "取消收藏" : "收藏"}
              aria-pressed={isFavorite}
              className={`grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed ${isFavorite ? "text-danger" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onFavorite?.();
              }}
            >
              {isFavorite ? (
                <HeartFilled className="text-danger" />
              ) : (
                <HeartOutlined />
              )}
            </button>
            <button
              type="button"
              aria-label="删除"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-transparent text-sm text-white/95 transition duration-200 hover:scale-110 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
            >
              <DeleteOutlined />
            </button>
          </div>
        )}
      </div>
      <Link
        aria-label={`播放 ${item.title}`}
        className="grid gap-1.5 p-3.5 text-(--ant-color-text)! outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        href={createPlayHref(item, variant)}
        prefetch={false}
        onClick={onClick}
      >
        {isContinueWatching ? (
          <>
            <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 transition-colors group-hover:text-accent">
              {item.title}
            </h3>
            <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted">
              {item.year && <span>{item.year}</span>}
              {progress && (
                <span className="truncate text-(--ant-color-text)/80">
                  {progress.sourceName}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 transition-colors group-hover:text-accent">
              {item.title}
            </h3>
            {item.year && <p className="text-xs text-muted">{item.year}</p>}
          </>
        )}
      </Link>
    </article>
  );
}
