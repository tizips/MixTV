"use client";

type WelcomeBannerProps = {
  userName?: string;
};

export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const greeting = userName ? `欢迎回来，${userName}` : "欢迎来到 MixTV";

  return (
    <section className="mb-6 rounded-lg bg-[var(--homepage-surface)] p-6 backdrop-blur-md">
      <h1 className="text-3xl font-bold text-[var(--homepage-text)]">{greeting}</h1>
      <p className="mt-2 text-[var(--homepage-muted)]">探索精彩影视内容</p>
    </section>
  );
}
