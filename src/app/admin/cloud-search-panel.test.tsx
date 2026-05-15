// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudSearchPanel } from "./cloud-search-panel";

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
    onPress,
    type,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button onClick={onPress} type={type ?? "button"}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children }: { children?: ReactNode }) => <section>{children}</section>, {
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Checkbox: ({
    children,
    value,
  }: {
    children?: ReactNode | ((state: { isFocusVisible: boolean; isSelected: boolean }) => ReactNode);
    value?: string;
  }) => (
    <label>
      <input type="checkbox" value={value} />
      {typeof children === "function" ? children({ isFocusVisible: false, isSelected: false }) : children}
    </label>
  ),
  CheckboxGroup: ({
    "aria-label": ariaLabel,
    children,
  }: {
    "aria-label"?: string;
    children?: ReactNode;
  }) => <div aria-label={ariaLabel}>{children}</div>,
  Chip: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  Form: ({
    children,
    onSubmit,
  }: {
    children?: ReactNode;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
  }) => <form onSubmit={onSubmit}>{children}</form>,
  Input: ({ onChange, value }: { onChange?: React.ChangeEventHandler<HTMLInputElement>; value?: string }) => (
    <input onChange={onChange} value={value} />
  ),
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  Switch: Object.assign(
    ({
      "aria-label": ariaLabel,
      isSelected,
      onChange,
    }: {
      "aria-label"?: string;
      children?: ReactNode;
      isSelected?: boolean;
      onChange?: (selected: boolean) => void;
    }) => (
      <input
        aria-label={ariaLabel}
        checked={Boolean(isSelected)}
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

function renderCloudSearchPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <CloudSearchPanel />
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

describe("CloudSearchPanel", () => {
  it("loads the cloud search config and drive types once under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 30,
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => [
          { key: "baidu", label: "百度网盘" },
          { key: "quark", label: "夸克网盘" },
        ],
        ok: true,
      } as Response);

    const { root } = renderCloudSearchPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/cloud-search");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/cloud-search/types");
    expect(toastState.success).toHaveBeenCalledWith("网盘搜索配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("saves the current cloud search config and tests the PanSou connection", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          supportedDriveTypes: ["baidu", "quark"],
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => [
          { key: "baidu", label: "百度网盘" },
          { key: "quark", label: "夸克网盘" },
        ],
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 30,
          supportedDriveTypes: ["baidu", "quark"],
          updatedAt: "2026-05-15T00:00:00.000Z",
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          checkedAt: "2026-05-15T00:00:00.000Z",
          message: "PanSou endpoint accepted: https://so.252035.xyz",
          ok: true,
        }),
        ok: true,
      } as Response);

    const { host, root } = renderCloudSearchPanel();

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

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/cloud-search", {
      body: JSON.stringify({
        enabled: true,
        panSouUrl: "https://so.252035.xyz",
        requestTimeoutSeconds: 30,
        supportedDriveTypes: ["baidu", "quark"],
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(toastState.success).toHaveBeenCalledWith("网盘搜索配置已保存");

    await act(async () => {
      testButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/cloud-search/test", {
      body: JSON.stringify({ panSouUrl: "https://so.252035.xyz" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(toastState.success).toHaveBeenLastCalledWith("网盘连接测试成功");

    act(() => {
      root.unmount();
    });
  });

  it("uses the default PanSou URL when the field is blank", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 10,
          supportedDriveTypes: ["baidu", "quark"],
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => [
          { key: "baidu", label: "百度网盘" },
          { key: "quark", label: "夸克网盘" },
        ],
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 10,
          supportedDriveTypes: ["baidu", "quark"],
          updatedAt: "2026-05-15T00:00:00.000Z",
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          checkedAt: "2026-05-15T00:00:00.000Z",
          message: "PanSou endpoint accepted: https://so.252035.xyz",
          ok: true,
        }),
        ok: true,
      } as Response);

    const { host, root } = renderCloudSearchPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const panSouUrlInput = Array.from(host.querySelectorAll("input")).find(
      (input) => input.value === "https://so.252035.xyz",
    ) as HTMLInputElement | undefined;
    const saveButton = host.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const testButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("测试链接"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      if (panSouUrlInput) {
        panSouUrlInput.value = "   ";
        panSouUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      saveButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/cloud-search", {
      body: JSON.stringify({
        enabled: true,
        panSouUrl: "https://so.252035.xyz",
        requestTimeoutSeconds: 10,
        supportedDriveTypes: ["baidu", "quark"],
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    await act(async () => {
      testButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/cloud-search/test", {
      body: JSON.stringify({ panSouUrl: "https://so.252035.xyz" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });

  it("shows the drive types API error when drive types fail to load", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 30,
          supportedDriveTypes: [],
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ message: "支持的网盘类型读取失败" }),
        ok: false,
        status: 500,
      } as Response);

    const { root } = renderCloudSearchPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastState.danger).toHaveBeenCalledWith("支持的网盘类型读取失败");

    act(() => {
      root.unmount();
    });
  });
});
