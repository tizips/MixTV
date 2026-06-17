"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { PageActivityTracker } from "@/modules/stats/ui/page-activity-tracker";

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
    <StyleProvider layer>
      <ConfigProvider
        theme={{
          algorithm: isDark
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
          hashed: false,
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
    </StyleProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useHandledViewTransitions();

  return (
    <>
      <ThemeProvider
        defaultTheme="system"
        disableTransitionOnChange
        storageKey="mixtv-theme-mode"
      >
        <AntdThemeBridge>{children}</AntdThemeBridge>
      </ThemeProvider>
    </>
  );
}
