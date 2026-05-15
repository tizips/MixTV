// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimingManagementPanel } from "./timing-management-panel";

const toastState = vi.hoisted(() => ({
  danger: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@heroui/react", () => ({
  Alert: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    Indicator: () => <span />,
    Title: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  }),
  Button: ({
    children,
    isDisabled,
    type,
  }: {
    children?: ReactNode;
    isDisabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button disabled={isDisabled} type={type ?? "button"}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children }: { children?: ReactNode }) => <section>{children}</section>, {
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Chip: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  Form: ({
    children,
    onSubmit,
  }: {
    children?: ReactNode;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
  }) => <form onSubmit={onSubmit}>{children}</form>,
  Input: ({
    "aria-label": ariaLabel,
    max,
    min,
    onChange,
    type,
    value,
  }: {
    "aria-label"?: string;
    max?: number;
    min?: number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
    value?: string;
  }) => <input aria-label={ariaLabel} max={max} min={min} onChange={onChange} type={type} value={value} />,
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  Switch: Object.assign(
    ({
      "aria-label": ariaLabel,
      isDisabled,
      isSelected,
      onChange,
    }: {
      "aria-label"?: string;
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
  TextField: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  toast: toastState,
}));

function renderTimingManagementPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <TimingManagementPanel />
      </StrictMode>,
    );
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

describe("TimingManagementPanel", () => {
  it("loads the timing management config once under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        autoRefreshEnabled: true,
        maxRecordsPerRun: 88,
        maxSearchPages: 4,
        onlyRefreshOngoingSeries: true,
        recentActiveDays: 14,
        siteCacheSeconds: 900,
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { root } = renderTimingManagementPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/timing-management");
    expect(toastState.success).toHaveBeenCalledWith("定时管理配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("saves the current timing management config", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          autoRefreshEnabled: true,
          maxRecordsPerRun: 88,
          maxSearchPages: 4,
          onlyRefreshOngoingSeries: true,
          recentActiveDays: 14,
          siteCacheSeconds: 900,
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          autoRefreshEnabled: false,
          maxRecordsPerRun: 88,
          maxSearchPages: 4,
          onlyRefreshOngoingSeries: true,
          recentActiveDays: 14,
          siteCacheSeconds: 900,
          updatedAt: "2026-05-15T00:00:00.000Z",
        }),
        ok: true,
      } as Response);

    const { host, root } = renderTimingManagementPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const autoRefreshSwitch = host.querySelector(
      'input[aria-label="启用自动刷新播放记录和收藏"]',
    ) as HTMLInputElement | null;
    const saveButton = host.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    await act(async () => {
      autoRefreshSwitch?.click();
      saveButton?.click();
      await Promise.resolve();
    });

    const saveRequest = fetchMock.mock.calls.at(-1);

    expect(saveRequest?.[0]).toBe("/api/admin/timing-management");
    expect(saveRequest?.[1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      autoRefreshEnabled: false,
      maxRecordsPerRun: 88,
      maxSearchPages: 4,
      onlyRefreshOngoingSeries: true,
      recentActiveDays: 14,
      siteCacheSeconds: 900,
    });
    expect(toastState.success).toHaveBeenCalledWith("定时管理配置已保存");

    act(() => {
      root.unmount();
    });
  });
});
