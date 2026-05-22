// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { CloudSearchPanel, resetCloudSearchPanelState } from "./cloud-search-panel";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

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
  resetCloudSearchPanelState();
  toastState.error.mockReset();
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
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
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
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
      await Promise.resolve();
    });

    const configForm = host.querySelector("#cloud-search-config-form") as HTMLFormElement | null;
    const testButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("测试链接"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      configForm?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
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

  it("renders supported drive types as selectable option cards", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 30,
          supportedDriveTypes: ["baidu"],
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

    const { host, root } = renderCloudSearchPanel();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
      await Promise.resolve();
    });

    const options = host.querySelectorAll("[data-drive-type-option]");
    const selectedOption = host.querySelector('[data-drive-type-option="baidu"]');
    const unselectedOption = host.querySelector('[data-drive-type-option="quark"]');

    expect(options).toHaveLength(2);
    expect(selectedOption?.getAttribute("data-selected")).toBe("true");
    expect(unselectedOption?.getAttribute("data-selected")).toBe("false");
    expect(selectedOption?.textContent).toContain("百度网盘");
    expect(unselectedOption?.textContent).toContain("夸克网盘");

    await act(async () => {
      (selectedOption as HTMLButtonElement | null)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(
      host
        .querySelector('[data-drive-type-option="baidu"]')
        ?.getAttribute("data-selected"),
    ).toBe("false");

    const currentUnselectedOption = host.querySelector(
      '[data-drive-type-option="quark"]',
    );

    await act(async () => {
      (currentUnselectedOption as HTMLButtonElement | null)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(
      host
        .querySelector('[data-drive-type-option="quark"]')
        ?.getAttribute("data-selected"),
    ).toBe("true");

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
      await Promise.resolve();
    });

    const panSouUrlInput = Array.from(host.querySelectorAll("input")).find(
      (input) => input.value === "https://so.252035.xyz",
    ) as HTMLInputElement | undefined;
    const configForm = host.querySelector("#cloud-search-config-form") as HTMLFormElement | null;
    const testButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("测试链接"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      if (panSouUrlInput) {
        panSouUrlInput.value = "   ";
        panSouUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      configForm?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
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

    for (let index = 0; index < 5 && toastState.error.mock.calls.length === 0; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/cloud-search/types");
    expect(toastState.error).toHaveBeenCalledWith("支持的网盘类型读取失败");

    act(() => {
      root.unmount();
    });
  });

  it("keeps the config form mounted while cloud search settings load", () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const { root } = renderCloudSearchPanel();

    expect(document.querySelector("#cloud-search-config-form")).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
