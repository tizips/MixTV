// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { SiteConfigPanel, resetSiteConfigPanelState } from "./site-config-panel";
import { env } from "@/shared/env";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

function renderSiteConfigPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <SiteConfigPanel />
      </StrictMode>,
    );
  });

  return root;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  resetSiteConfigPanelState();
  toastState.error.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SiteConfigPanel", () => {
  it("does not duplicate the initial site config API request under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        doubanAuth: "",
        doubanDataProxyMode: "direct",
        doubanDataProxyUrl: "",
        doubanImageProxyMode: "direct",
        doubanImageProxyUrl: "",
        showAdultContent: false,
        siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
        siteName: env.NEXT_PUBLIC_SITE_NAME,
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const root = renderSiteConfigPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-config");
    expect(toastState.success).toHaveBeenCalledWith("站点配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("shows a danger toast when the initial site config request fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
    } as Response);

    const root = renderSiteConfigPanel();

    for (let index = 0; index < 5 && toastState.error.mock.calls.length === 0; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-config");
    expect(toastState.error).toHaveBeenCalledWith("站点配置读取失败");

    act(() => {
      root.unmount();
    });
  });

  it("keeps the main config form mounted while the initial site config request is loading", () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const root = renderSiteConfigPanel();

    expect(document.querySelector("#site-config-main-form")).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("shows the last updated time after loading site config", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        doubanAuth: "",
        doubanDataProxyMode: "direct",
        doubanDataProxyUrl: "",
        doubanImageProxyMode: "direct",
        doubanImageProxyUrl: "",
        showAdultContent: false,
        siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
        siteName: env.NEXT_PUBLIC_SITE_NAME,
        updatedAt: "2026-05-20T00:00:00.000Z",
      }),
      ok: true,
    } as Response);

    const root = renderSiteConfigPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("最后更新时间");
    expect(document.body.textContent).not.toContain("最后更新时间 未保存");

    act(() => {
      root.unmount();
    });
  });

  it("submits main site config through an AntD form", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          doubanAuth: "old-auth",
          doubanDataProxyMode: "direct",
          doubanDataProxyUrl: "",
          doubanImageProxyMode: "direct",
          doubanImageProxyUrl: "",
          showAdultContent: false,
          siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
          siteName: env.NEXT_PUBLIC_SITE_NAME,
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          doubanAuth: "new-auth",
          doubanDataProxyMode: "custom",
          doubanDataProxyUrl: "https://data.example.com",
          doubanImageProxyMode: "custom",
          doubanImageProxyUrl: "https://image.example.com",
          showAdultContent: false,
          siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
          siteName: env.NEXT_PUBLIC_SITE_NAME,
          updatedAt: "2026-05-20T00:00:00.000Z",
        }),
        ok: true,
      } as Response);

    const root = renderSiteConfigPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const mainForm = document.querySelector("#site-config-main-form") as HTMLFormElement | null;
    const dataProxySelect = mainForm?.querySelector<HTMLSelectElement>('select[name="doubanDataProxyMode"]');
    const imageProxySelect = mainForm?.querySelector<HTMLSelectElement>('select[name="doubanImageProxyMode"]');
    const authInput = mainForm?.querySelector<HTMLTextAreaElement>('textarea[name="doubanAuth"]');

    expect(mainForm).not.toBeNull();
    expect(dataProxySelect?.value).toBe("direct");
    expect(imageProxySelect?.value).toBe("direct");
    expect(authInput?.value).toBe("old-auth");

    await act(async () => {
      dataProxySelect!.value = "custom";
      dataProxySelect!.dispatchEvent(new Event("change", { bubbles: true }));
      imageProxySelect!.value = "custom";
      imageProxySelect!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    const dataProxyInput = mainForm?.querySelector<HTMLInputElement>('input[name="doubanDataProxyUrl"]');
    const imageProxyInput = mainForm?.querySelector<HTMLInputElement>('input[name="doubanImageProxyUrl"]');

    await act(async () => {
      dataProxyInput!.value = "https://data.example.com";
      dataProxyInput!.dispatchEvent(new Event("input", { bubbles: true }));
      imageProxyInput!.value = "https://image.example.com";
      imageProxyInput!.dispatchEvent(new Event("input", { bubbles: true }));
      authInput!.value = "new-auth";
      authInput!.dispatchEvent(new Event("input", { bubbles: true }));
      mainForm!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-config/main",
      expect.objectContaining({
        body: JSON.stringify({
          doubanAuth: "new-auth",
          doubanDataProxyMode: "custom",
          doubanDataProxyUrl: "https://data.example.com",
          doubanImageProxyMode: "custom",
          doubanImageProxyUrl: "https://image.example.com",
        }),
        method: "POST",
      }),
    );

    act(() => {
      root.unmount();
    });
  });
});
