"use client";

import { useState } from "react";
import type { HomepageData } from "../application/homepage-service";
import { WelcomeBanner } from "./welcome-banner";
import { LoadingOverlay } from "./loading-overlay";
import { HeroBanner } from "./hero-banner";
import { ContentCarousel } from "./content-carousel";

type HomepageShellProps = {
  data: HomepageData;
  userName?: string;
};

export function HomepageShell({ data, userName }: HomepageShellProps) {
  const [isLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6 lg:p-8">
      <LoadingOverlay isLoading={isLoading} />
      
      <WelcomeBanner userName={userName} />
      
      {data.heroBanner.length > 0 && (
        <HeroBanner items={data.heroBanner} />
      )}
      
      <div className="space-y-8">
        {data.sections.map((section) => (
          <ContentCarousel
            key={section.key}
            title={section.title}
            items={section.items}
            moreLink={section.moreLink}
          />
        ))}
      </div>
    </div>
  );
}
