"use client";

type WelcomeBannerProps = {
  userName?: string;
};

export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const greeting = userName ? `欢迎回来，${userName}` : "欢迎来到 MixTV";

  return (
    <div className="mb-6 p-6 rounded-lg backdrop-blur-md bg-black/30 border border-white/10">
      <h1 className="text-white text-3xl font-bold mb-2">{greeting}</h1>
      <p className="text-gray-400">探索精彩影视内容</p>
    </div>
  );
}
