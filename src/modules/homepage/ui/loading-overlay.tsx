"use client";

type LoadingOverlayProps = {
  isLoading: boolean;
};

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-default-200 bg-surface px-6 py-6 shadow-lg">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-default-200 border-t-accent" />
        <p className="text-lg font-medium text-foreground">加载中...</p>
      </div>
    </div>
  );
}
