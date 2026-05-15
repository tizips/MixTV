// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DanmakuPanel } from "./danmaku-panel";

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
    onPress,
    type,
  }: {
    children?: ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button disabled={isDisabled} onClick={onPress} type={type ?? "button"}>
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
    onChange,
    type,
    value,
  }: {
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
    value?: string;
  }) => <input onChange={onChange} type={type} value={value} />,
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

function renderDanmakuPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <DanmakuPanel />
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

describe("DanmakuPanel", () => {
  it("loads the danmaku config once under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        enabled: true,
        apiUrl: "https://danmaku.test",
        apiToken: "secret-token",
        requestTimeoutSeconds: 12,
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { root } = renderDanmakuPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/danmaku");
    expect(toastState.success).toHaveBeenCalledWith("弹幕配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("saves the current danmaku config and tests the danmaku connection", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          apiUrl: "https://danmaku.test",
          apiToken: "secret-token",
          requestTimeoutSeconds: 12,
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          apiUrl: "https://danmaku.test",
          apiToken: "secret-token",
          requestTimeoutSeconds: 12,
          updatedAt: "2026-05-15T00:00:00.000Z",
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          checkedAt: "2026-05-15T00:00:00.000Z",
          message: "Danmaku endpoint accepted: https://danmaku.test",
          ok: true,
        }),
        ok: true,
      } as Response);

    const { host, root } = renderDanmakuPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const saveButton = host.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const testButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("测试链接"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });

    const saveRequest = fetchMock.mock.calls.at(-1);

    expect(saveRequest?.[0]).toBe("/api/admin/danmaku");
    expect(saveRequest?.[1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      enabled: true,
      apiUrl: "https://danmaku.test",
      apiToken: "secret-token",
      requestTimeoutSeconds: 12,
    });
    expect(toastState.success).toHaveBeenCalledWith("弹幕配置已保存");

    await act(async () => {
      testButton?.click();
      await Promise.resolve();
    });

    const testRequest = fetchMock.mock.calls.at(-1);

    expect(testRequest?.[0]).toBe("/api/admin/danmaku/test");
    expect(testRequest?.[1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(JSON.parse(String(testRequest?.[1]?.body))).toEqual({
      apiToken: "secret-token",
      apiUrl: "https://danmaku.test",
    });
    expect(toastState.success).toHaveBeenLastCalledWith("弹幕连接测试成功");

    act(() => {
      root.unmount();
    });
  });
});
