"use client";

import { DesktopOutlined, MoonFilled, SunFilled } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

type ThemeMode = "system" | "light" | "dark";

const themeModes: ThemeMode[] = ["system", "light", "dark"];

const modeConfig: Record<
  ThemeMode,
  { Icon: typeof DesktopOutlined; label: string }
> = {
  system: { Icon: DesktopOutlined, label: "自动" },
  light: { Icon: SunFilled, label: "浅色" },
  dark: { Icon: MoonFilled, label: "深色" },
};

function getNextMode(mode: ThemeMode): ThemeMode {
  const currentIndex = themeModes.indexOf(mode);
  return themeModes[(currentIndex + 1) % themeModes.length];
}

function getThemeMode(theme?: string): ThemeMode {
  return theme === "light" || theme === "dark" || theme === "system"
    ? theme
    : "system";
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const mode = getThemeMode(theme);
  const config = modeConfig[mode];
  const CurrentIcon = config.Icon;

  function handlePress() {
    const nextMode = getNextMode(mode);

    setTheme(nextMode);
  }

  if (!mounted) {
    return (
      <Button
        aria-label="主题切换初始化中"
        disabled
        shape="circle"
        type="text"
        icon={<DesktopOutlined />}
      />
    );
  }

  return (
    <Button
      aria-label={`切换主题，当前${config.label}`}
      shape="circle"
      type="text"
      onClick={handlePress}
      icon={<CurrentIcon />}
    />
  );
}
