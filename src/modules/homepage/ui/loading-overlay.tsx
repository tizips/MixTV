"use client";

type LoadingOverlayProps = {
  isLoading: boolean;
};

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "color-mix(in srgb, var(--homepage-bg) 80%, transparent)" }}>
      <div className="flex flex-col items-center gap-4 rounded-lg p-6" style={{ backgroundColor: "var(--homepage-surface)" }}>
        <div className="h-16 w-16 animate-spin rounded-full border-4" style={{ borderColor: "var(--homepage-border)", borderTopColor: "var(--homepage-text)" }} />
        <p className="text-lg font-medium" style={{ color: "var(--homepage-text)" }}>加载中...</p>
      </div>
    </div>
  );
}
