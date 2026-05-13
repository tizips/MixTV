"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { HeroItem } from "../domain/content-types";

type HeroBannerProps = {
  items: HeroItem[];
};

export function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setImageError(false);
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];
  const fallbackBackdropUrl = createPlaceholderImageUrl({
    variant: "backdrop",
    fileStem: currentItem.title,
    seed: currentItem.id,
  });

  return (
    <div className="relative mb-8 h-[70vh] w-full overflow-hidden rounded-lg bg-surface-secondary">
      {/* Backdrop Image */}
      <div className="absolute inset-0">
        <Image
          src={imageError ? fallbackBackdropUrl : currentItem.backdropUrl}
          alt={currentItem.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          onError={() => setImageError(true)}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-end p-8 md:p-12">
        <div className="max-w-2xl">
          {/* Frosted Info Panel */}
          <div className="rounded-lg bg-surface/85 p-6 shadow-surface backdrop-blur-md">
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              {currentItem.title}
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-lg font-semibold text-accent">
                ⭐ {currentItem.rating.toFixed(1)}
              </span>
              <span className="text-sm uppercase text-muted">
                {currentItem.type}
              </span>
            </div>
            <p className="text-base leading-relaxed text-muted line-clamp-3">
              {currentItem.description}
            </p>
          </div>
        </div>
      </div>

      {/* Dot Indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setImageError(false);
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-accent w-8"
                  : "bg-muted/50 hover:bg-muted/75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
