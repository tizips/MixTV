"use client";

type LoadingOverlayProps = {
  isLoading: boolean;
};

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface p-6 shadow-overlay">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-accent" />
        <p className="text-lg font-medium text-foreground">加载中...</p>
      </div>
    </div>
  );
}
