"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { HeroItem } from "../domain/content-types";

type HeroBannerProps = {
  items: HeroItem[];
};

const FALLBACK_BACKDROP = "https://ts1.tc.mm.bing.net/th?id=OHR.SkradinskiBuk_ZH-CN0882603359_3840x2160.avif";

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

  return (
    <div className="relative mb-8 h-[70vh] w-full overflow-hidden rounded-lg bg-[var(--homepage-surface-strong)]">
      {/* Backdrop Image */}
      <div className="absolute inset-0">
        <Image
          src={imageError ? FALLBACK_BACKDROP : currentItem.backdropUrl}
          alt={currentItem.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          onError={() => setImageError(true)}
        />
        {/* Gradient Overlay */}
        {/* <div className="absolute inset-0 bg-gradient-to-t from-[var(--homepage-bg)] via-[var(--homepage-bg)]/10 to-transparent" /> */}
      </div>

      {/* Content */}
      <div className="relative h-full flex items-end p-8 md:p-12">
        <div className="max-w-2xl">
          {/* Frosted Info Panel */}
          <div className="rounded-lg bg-[var(--homepage-surface)] p-6 backdrop-blur-md">
            <h2 className="mb-4 text-4xl font-bold text-[var(--homepage-text)] md:text-5xl">
              {currentItem.title}
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-lg font-semibold text-[var(--homepage-accent)]">
                ⭐ {currentItem.rating.toFixed(1)}
              </span>
              <span className="text-sm uppercase text-[var(--homepage-muted)]">
                {currentItem.type}
              </span>
            </div>
            <p className="text-base leading-relaxed text-[var(--homepage-muted)] line-clamp-3">
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
                  ? "bg-[var(--homepage-accent)] w-8"
                  : "bg-[var(--homepage-muted)]/50 hover:bg-[var(--homepage-muted)]/75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
