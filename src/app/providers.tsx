"use client";

import type { ReactNode } from "react";
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

export function Providers({ children }: { children: ReactNode }) {
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
