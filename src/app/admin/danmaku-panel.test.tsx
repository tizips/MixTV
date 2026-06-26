// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { DanmakuPanel, resetDanmakuPanelState } from "./danmaku-panel";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

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
  resetDanmakuPanelState();
  toastState.error.mockReset();
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
        loadMode: "full",
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { root } = renderDanmakuPanel();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
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
          loadMode: "full",
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
          loadMode: "full",
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
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
      await Promise.resolve();
    });

    const configForm = host.querySelector("#danmaku-config-form") as HTMLFormElement | null;
    const testButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("测试链接"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      configForm?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
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
      loadMode: "full",
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

  it("keeps the config form mounted while danmaku settings load", () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const { root } = renderDanmakuPanel();

    expect(document.querySelector("#danmaku-config-form")).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
