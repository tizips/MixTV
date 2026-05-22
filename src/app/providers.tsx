"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import { PageActivityTracker } from "@/modules/stats/ui/page-activity-tracker";
import { useTheme } from "next-themes";

const themeStorageMigrationScript = `
try {
  const storageKey = "mixtv-theme-mode";
  if (localStorage.getItem(storageKey) === "auto") {
    localStorage.setItem(storageKey, "system");
  }
} catch {}
`;

function isBenignViewTransitionRejection(reason: unknown) {
  if (!reason || typeof reason !== "object") {
    return false;
  }

  const error = reason as { message?: unknown; name?: unknown };
  const message = typeof error.message === "string" ? error.message : "";

  return (
    error.name === "AbortError" ||
    (error.name === "InvalidStateError" &&
      (message === "Transition was aborted because of invalid state" ||
        message ===
          "View transition was skipped because document visibility state is hidden." ||
        message ===
          "Skipping view transition because document visibility state has become hidden." ||
        message === "Skipping view transition because viewport size changed."))
  );
}

function consumeViewTransitionPromise(promise: Promise<unknown> | undefined) {
  void promise?.catch((reason: unknown) => {
    if (!isBenignViewTransitionRejection(reason)) {
      console.error(reason);
    }
  });
}

function useHandledViewTransitions() {
  useEffect(() => {
    if (
      !("startViewTransition" in document) ||
      typeof document.startViewTransition !== "function"
    ) {
      return;
    }

    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "startViewTransition",
    );
    const originalStartViewTransition =
      document.startViewTransition.bind(document);
    const patchedStartViewTransition: typeof document.startViewTransition = (
      callback,
    ) => {
      const transition = originalStartViewTransition(callback);
      consumeViewTransitionPromise(transition.ready);
      consumeViewTransitionPromise(transition.updateCallbackDone);
      consumeViewTransitionPromise(transition.finished);
      return transition;
    };

    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: patchedStartViewTransition,
    });

    return () => {
      if (document.startViewTransition === patchedStartViewTransition) {
        if (originalDescriptor) {
          Object.defineProperty(
            document,
            "startViewTransition",
            originalDescriptor,
          );
        } else {
          Object.defineProperty(document, "startViewTransition", {
            configurable: true,
            value: originalStartViewTransition,
          });
        }
      }
    };
  }, []);
}

function AntdThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#0f9d83",
        },
      }}
      modal={{
        centered: true,
      }}
    >
      <App>
        <PageActivityTracker />
        {children}
      </App>
    </ConfigProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useHandledViewTransitions();

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: themeStorageMigrationScript }}
        suppressHydrationWarning
      />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        storageKey="mixtv-theme-mode"
      >
        <AntdThemeBridge>{children}</AntdThemeBridge>
      </ThemeProvider>
    </>
  );
}
