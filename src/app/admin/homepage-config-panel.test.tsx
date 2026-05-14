// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageConfigPanel } from "./homepage-config-panel";

const toastState = vi.hoisted(() => ({
  danger: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  Card: Object.assign(({ children }: { children: ReactNode }) => <section>{children}</section>, {
    Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ListBox: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
  Switch: Object.assign(
    ({
      "aria-label": ariaLabel,
      isDisabled,
      isSelected,
      onChange,
    }: {
      "aria-label"?: string;
      children?: ReactNode;
      isDisabled?: boolean;
      isSelected?: boolean;
      onChange?: (selected: boolean) => void;
    }) => (
      <input
        aria-label={ariaLabel}
        checked={Boolean(isSelected)}
        disabled={isDisabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        type="checkbox"
      />
    ),
    {
      Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Thumb: () => <span />,
    },
  ),
  toast: toastState,
}));

function renderHomepageConfigPanel({ strict = false }: { strict?: boolean } = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const panel = <HomepageConfigPanel />;

  act(() => {
    root.render(strict ? <StrictMode>{panel}</StrictMode> : panel);
  });

  return { host, root };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  toastState.danger.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("HomepageConfigPanel", () => {
  it("does not duplicate the initial homepage API request under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        modules: {
          carousel: false,
          "welcome-announcement": true,
          "continue-watching": true,
          "coming-soon": true,
          "trending-movies": true,
          "trending-series": true,
          "new-anime": true,
          "trending-variety": true,
          "trending-short-dramas": true,
        },
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { root } = renderHomepageConfigPanel({ strict: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/homepage");

    act(() => {
      root.unmount();
    });
  });

  it("loads homepage config and saves switch changes immediately", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          modules: {
            carousel: false,
            "welcome-announcement": true,
            "continue-watching": true,
            "coming-soon": true,
            "trending-movies": true,
            "trending-series": true,
            "new-anime": true,
            "trending-variety": true,
            "trending-short-dramas": true,
          },
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          modules: {
            carousel: true,
            "welcome-announcement": false,
            "continue-watching": true,
            "coming-soon": true,
            "trending-movies": true,
            "trending-series": true,
            "new-anime": true,
            "trending-variety": true,
            "trending-short-dramas": true,
          },
          updatedAt: "2026-05-14T00:00:00.000Z",
        }),
        ok: true,
      } as Response);

    const { host, root } = renderHomepageConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/homepage");
    expect(toastState.success).toHaveBeenCalledWith("首页配置已加载");
    expect(host.textContent).not.toContain("保存配置");

    const carouselSwitch = host.querySelector('input[aria-label="切换焦点轮播"]') as HTMLInputElement | null;
    expect(carouselSwitch?.checked).toBe(false);

    await act(async () => {
      carouselSwitch?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/homepage/switch", {
      body: JSON.stringify({ key: "carousel", value: true }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(toastState.success).toHaveBeenLastCalledWith("首页模块配置已保存");

    const welcomeSwitch = host.querySelector('input[aria-label="切换欢迎公告"]') as HTMLInputElement | null;
    expect(welcomeSwitch?.checked).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  it("shows a danger toast when switch saving fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          modules: {
            carousel: false,
            "welcome-announcement": true,
            "continue-watching": true,
            "coming-soon": true,
            "trending-movies": true,
            "trending-series": true,
            "new-anime": true,
            "trending-variety": true,
            "trending-short-dramas": true,
          },
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ message: "failed" }),
        ok: false,
      } as Response);

    const { host, root } = renderHomepageConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const carouselSwitch = host.querySelector('input[aria-label="切换焦点轮播"]') as HTMLInputElement | null;

    await act(async () => {
      carouselSwitch?.click();
      await Promise.resolve();
    });

    expect(toastState.danger).toHaveBeenCalledWith("首页模块配置保存失败");
    expect(carouselSwitch?.checked).toBe(false);

    act(() => {
      root.unmount();
    });
  });
});
