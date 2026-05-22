// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { TimingManagementPanel, resetTimingManagementPanelState } from "./timing-management-panel";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

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
  resetTimingManagementPanelState();
  toastState.error.mockReset();
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

  it("keeps the config form mounted while timing settings load", () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const { root } = renderTimingManagementPanel();

    expect(document.querySelector("#timing-management-config-form")).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
