// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceMonitoringPanel } from "./performance-monitoring-panel";

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
}));

function renderPerformanceMonitoringPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <PerformanceMonitoringPanel />
      </StrictMode>,
    );
  });

  return { host, root };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("PerformanceMonitoringPanel", () => {
  it("loads performance metrics from the admin performance API once under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        checkedAt: "2026-05-15T00:00:00.000Z",
        metrics: [
          {
            detail: "4 核 · Apple M4",
            icon: "bi-cpu",
            key: "process-cpu",
            title: "进程 CPU",
            tone: "text-accent",
            value: "3.2%",
          },
          {
            detail: "RSS: 124 MB",
            detailAccent: "堆内存: 72 MB / 96 MB",
            icon: "bi-memory",
            key: "process-memory",
            title: "进程内存",
            tone: "text-accent",
            value: "124 MB",
          },
        ],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderPerformanceMonitoringPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/performance");
    expect(host.textContent).toContain("3.2%");
    expect(host.textContent).toContain("RSS: 124 MB");
    expect(host.textContent).toContain("最后刷新 08:00:00");

    act(() => {
      root.unmount();
    });
  });

  it("refreshes metrics and keeps an API error visible", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          checkedAt: "2026-05-15T00:00:00.000Z",
          metrics: [
            {
              detail: "请求吞吐统计暂未接入",
              icon: "bi-arrow-left-right",
              key: "request",
              title: "请求/分钟",
              tone: "text-default-500",
              value: "未接入",
            },
          ],
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ message: "metrics failed" }),
        ok: false,
      } as Response);

    const { host, root } = renderPerformanceMonitoringPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const refreshButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("刷新"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      refreshButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("metrics failed");
    expect(host.textContent).toContain("未接入");

    act(() => {
      root.unmount();
    });
  });
});
