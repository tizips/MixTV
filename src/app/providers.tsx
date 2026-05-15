"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toast } from "@heroui/react";

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
        message === "View transition was skipped because document visibility state is hidden." ||
        message === "Skipping view transition because document visibility state has become hidden." ||
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
    if (!("startViewTransition" in document) || typeof document.startViewTransition !== "function") {
      return;
    }

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, "startViewTransition");
    const originalStartViewTransition = document.startViewTransition.bind(document);
    const patchedStartViewTransition: typeof document.startViewTransition = (callback) => {
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
          Object.defineProperty(document, "startViewTransition", originalDescriptor);
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
        {children}
      </ThemeProvider>
      <Toast.Provider placement="top end" />
    </>
  );
}
