"use client";

import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

type ThemeMode = "system" | "light" | "dark";

const themeModes: ThemeMode[] = ["system", "light", "dark"];

const modeConfig: Record<ThemeMode, { icon: string; label: string }> = {
  system: { icon: "bi-circle-half", label: "自动" },
  light: { icon: "bi-sun-fill", label: "浅色" },
  dark: { icon: "bi-moon-stars-fill", label: "深色" },
};

function getNextMode(mode: ThemeMode): ThemeMode {
  const currentIndex = themeModes.indexOf(mode);
  return themeModes[(currentIndex + 1) % themeModes.length];
}

function getThemeMode(theme?: string): ThemeMode {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

function subscribeToClientMount(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
}

function getClientMountSnapshot() {
  return true;
}

function getServerMountSnapshot() {
  return false;
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountSnapshot,
    getServerMountSnapshot,
  );
  const mode = getThemeMode(theme);
  const config = modeConfig[mode];

  function handlePress() {
    const nextMode = getNextMode(mode);

    setTheme(nextMode);
  }

  if (!mounted) {
    return (
      <Button
        aria-label="主题切换初始化中"
        className="h-10 w-10 rounded-full p-0"
        isDisabled
        isIconOnly
        variant="ghost"
      >
        <i aria-hidden="true" className="bi bi-circle-half text-base" />
      </Button>
    );
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
