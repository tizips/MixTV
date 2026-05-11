"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";

type ThemeMode = "auto" | "light" | "dark";

const storageKey = "mixtv-theme-mode";
const themeModes: ThemeMode[] = ["auto", "light", "dark"];

const modeConfig: Record<ThemeMode, { icon: string; label: string }> = {
  auto: { icon: "bi-circle-half", label: "自动" },
  light: { icon: "bi-sun-fill", label: "浅色" },
  dark: { icon: "bi-moon-stars-fill", label: "深色" },
};

const themeModeListeners = new Set<() => void>();

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

function applyThemeMode(mode: ThemeMode) {
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = mode;
}

function getNextMode(mode: ThemeMode): ThemeMode {
  const currentIndex = themeModes.indexOf(mode);
  return themeModes[(currentIndex + 1) % themeModes.length];
}

function getThemeModeSnapshot(): ThemeMode {
  const storedMode = localStorage.getItem(storageKey);
  return isThemeMode(storedMode) ? storedMode : "auto";
}

function getServerThemeModeSnapshot(): ThemeMode {
  return "auto";
}

function subscribeToThemeMode(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey) {
      onStoreChange();
    }
  }

  themeModeListeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    themeModeListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function setStoredThemeMode(mode: ThemeMode) {
  localStorage.setItem(storageKey, mode);
  themeModeListeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(
    subscribeToThemeMode,
    getThemeModeSnapshot,
    getServerThemeModeSnapshot,
  );
  const config = modeConfig[mode];

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  function handlePress() {
    const nextMode = getNextMode(mode);

    setStoredThemeMode(nextMode);
  }

  return (
    <Button
      aria-label={`切换主题，当前${config.label}`}
      className="h-10 w-10 rounded-full p-0"
      isIconOnly
      onPress={handlePress}
      variant="ghost"
    >
      <i aria-hidden="true" className={`bi ${config.icon} text-base`} />
    </Button>
  );
}
