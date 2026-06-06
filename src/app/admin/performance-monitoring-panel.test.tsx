// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceMonitoringPanel } from "./performance-monitoring-panel";

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
            icon: "cpu",
            key: "system-cpu",
            title: "系统 CPU",
            tone: "text-accent",
            value: "4 核",
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
    expect(host.textContent).toContain("4 核");
    expect(host.textContent).toContain("Apple M4");
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
              icon: "arrow-left-right",
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
