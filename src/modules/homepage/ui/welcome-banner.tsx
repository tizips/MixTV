"use client";

import { env } from "@/shared/env";

type WelcomeBannerProps = {
  userName?: string;
};

export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const greeting = userName ? `欢迎回来，${userName}` : `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}`;

  return (
    <section className="mb-6 rounded-lg bg-surface p-6 shadow-surface backdrop-blur-md">
      <h1 className="text-3xl font-bold text-foreground">{greeting}</h1>
      <p className="mt-2 text-muted">探索精彩影视内容</p>
    </section>
  );
}
