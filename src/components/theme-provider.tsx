"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode | ((theme: ThemeMode) => ThemeMode)) => void;
  theme: ThemeMode;
};

const colorSchemeQuery = "(prefers-color-scheme: dark)";
const themeClassNames: ResolvedTheme[] = ["light", "dark"];

const ThemeContext = createContext<ThemeContextValue>({
  resolvedTheme: "light",
  setTheme: () => {},
  theme: "system",
});

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(colorSchemeQuery).matches ? "dark" : "light";
}

function getStoredTheme(storageKey: string, defaultTheme: ThemeMode): ThemeMode {
  if (typeof window === "undefined") {
    return defaultTheme;
  }

  try {
    const storedTheme = window.localStorage.getItem(storageKey);

    if (storedTheme === "auto") {
      window.localStorage.setItem(storageKey, "system");
      return "system";
    }

    return isThemeMode(storedTheme) ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

function disableCssTransitions() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important}",
    ),
  );
  document.head.append(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      style.remove();
    }, 1);
  };
}

function applyTheme(resolvedTheme: ResolvedTheme, disableTransition: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const enableTransitions = disableTransition ? disableCssTransitions() : null;
  const root = document.documentElement;

  root.classList.remove(...themeClassNames);
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;

  enableTransitions?.();
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  disableTransitionOnChange = true,
  storageKey = "theme",
}: {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    getStoredTheme(storageKey, defaultTheme),
  );
  const [systemTheme, setSystemTheme] =
    useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const setTheme = useCallback<ThemeContextValue["setTheme"]>(
    (nextTheme) => {
      setThemeState((currentTheme) => {
        const themeValue =
          typeof nextTheme === "function" ? nextTheme(currentTheme) : nextTheme;
        const safeTheme = isThemeMode(themeValue) ? themeValue : defaultTheme;

        try {
          window.localStorage.setItem(storageKey, safeTheme);
        } catch {}

        return safeTheme;
      });
    },
    [defaultTheme, storageKey],
  );

  useEffect(() => {
    applyTheme(resolvedTheme, disableTransitionOnChange);
  }, [disableTransitionOnChange, resolvedTheme]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(colorSchemeQuery);
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      setThemeState(isThemeMode(event.newValue) ? event.newValue : defaultTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [defaultTheme, storageKey]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme,
      theme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
