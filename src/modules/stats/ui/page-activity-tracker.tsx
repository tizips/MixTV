"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function sendBeacon(url: string, payload: object) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    } catch {
      // Fall back to fetch below.
    }
  }

  void fetch(url, {
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

export function PageActivityTracker() {
  const pathname = usePathname();
  const startedAtRef = useRef<number>(0);
  const flushedRef = useRef(false);

  useEffect(() => {
    if (!pathname || pathname === "/login") {
      return;
    }

    startedAtRef.current = performance.now();
    flushedRef.current = false;
    sendBeacon("/api/stats/collect", { kind: "visit" });

    const flushDuration = () => {
      if (flushedRef.current) {
        return;
      }

      flushedRef.current = true;
      const durationMs = Math.max(0, Math.round(performance.now() - startedAtRef.current));
      sendBeacon("/api/stats/collect", { durationMs, kind: "duration" });
    };

    const onPageHide = () => flushDuration();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDuration();
      }
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushDuration();
    };
  }, [pathname]);

  return null;
}
