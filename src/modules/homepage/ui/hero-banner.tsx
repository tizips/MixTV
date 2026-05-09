"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { HeroItem } from "../domain/content-types";

type HeroBannerProps = {
  items: HeroItem[];
};

export function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div className="relative w-full h-[70vh] mb-8 overflow-hidden rounded-lg">
      {/* Backdrop Image */}
      <div className="absolute inset-0">
        <Image
          src={currentItem.backdropUrl}
          alt={currentItem.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-end p-8 md:p-12">
        <div className="max-w-2xl">
          {/* Frosted Info Panel */}
          <div className="backdrop-blur-md bg-black/30 p-6 rounded-lg border border-white/10">
            <h2 className="text-white text-4xl md:text-5xl font-bold mb-4">
              {currentItem.title}
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-yellow-400 text-lg font-semibold">
                ⭐ {currentItem.rating.toFixed(1)}
              </span>
              <span className="text-gray-400 text-sm uppercase">
                {currentItem.type}
              </span>
            </div>
            <p className="text-gray-300 text-base leading-relaxed line-clamp-3">
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
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white w-8"
                  : "bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
