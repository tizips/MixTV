// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { ConfigFilesPanel, resetConfigFilesPanelState } from "./config-files-panel";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

function getConfigFileForms() {
  const subscriptionInput = document.querySelector<HTMLInputElement>(
    'input[name="url"]',
  );
  const contentInput = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="content"]',
  );

  return {
    contentForm: contentInput?.closest("form") as HTMLFormElement | null,
    contentInput,
    subscriptionForm: subscriptionInput?.closest("form") as HTMLFormElement | null,
    subscriptionInput,
  };
}

function renderConfigFilesPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <ConfigFilesPanel />
      </StrictMode>,
    );
  });

  return root;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  resetConfigFilesPanelState();
  toastState.error.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ConfigFilesPanel", () => {
  it("does not duplicate the initial config files API request under Strict Mode", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        content: {
          content: "{}",
          updatedAt: null,
        },
        subscription: {
          autoUpdate: false,
          updatedAt: null,
          url: "",
        },
      }),
      ok: true,
    } as Response);

    const root = renderConfigFilesPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/files");
    expect(toastState.success).toHaveBeenCalledWith("配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("shows an error toast when the initial config files request fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
    } as Response);

    const root = renderConfigFilesPanel();

    for (let index = 0; index < 5 && toastState.error.mock.calls.length === 0; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/files");
    expect(toastState.error).toHaveBeenCalledWith("配置读取失败");

    act(() => {
      root.unmount();
    });
  });

  it("keeps forms mounted while the initial config files request is loading", () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const root = renderConfigFilesPanel();

    const { contentForm, subscriptionForm } = getConfigFileForms();

    expect(subscriptionForm).not.toBeNull();
    expect(contentForm).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("submits subscription and content through AntD forms", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          content: {
            content: "{}",
            updatedAt: null,
          },
          subscription: {
            autoUpdate: false,
            updatedAt: null,
            url: "https://example.com/old.json",
          },
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          autoUpdate: false,
          updatedAt: "2026-05-20T00:00:00.000Z",
          url: "https://example.com/new.json",
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          content: {
            content: "{\"sites\":[]}",
            updatedAt: "2026-05-20T00:00:00.000Z",
          },
          subscription: {
            autoUpdate: false,
            updatedAt: "2026-05-20T00:00:00.000Z",
            url: "https://example.com/new.json",
          },
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          content: "{\"sites\":[{\"name\":\"demo\"}]}",
          updatedAt: "2026-05-20T00:00:00.000Z",
        }),
        ok: true,
      } as Response);

    const root = renderConfigFilesPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const { contentForm, contentInput, subscriptionForm, subscriptionInput } =
      getConfigFileForms();

    expect(subscriptionForm).not.toBeNull();
    expect(contentForm).not.toBeNull();
    expect(subscriptionInput?.value).toBe("https://example.com/old.json");
    expect(contentInput?.value).toBe("{}");

    await act(async () => {
      subscriptionInput!.value = "https://example.com/new.json";
      subscriptionInput!.dispatchEvent(new Event("input", { bubbles: true }));
      subscriptionForm!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/files/subscription/pull",
      expect.objectContaining({
        body: JSON.stringify({ url: "https://example.com/new.json" }),
        method: "POST",
      }),
    );

    await act(async () => {
      contentInput!.value = "{\"sites\":[{\"name\":\"demo\"}]}";
      contentInput!.dispatchEvent(new Event("input", { bubbles: true }));
      contentForm!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/files/subscriptions",
      expect.objectContaining({
        body: JSON.stringify({ content: "{\"sites\":[{\"name\":\"demo\"}]}" }),
        method: "POST",
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("keeps invalid content submissions inside Form.Item validation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        content: {
          content: "{}",
          updatedAt: null,
        },
        subscription: {
          autoUpdate: false,
          updatedAt: null,
          url: "https://example.com/source.json",
        },
      }),
      ok: true,
    } as Response);

    const root = renderConfigFilesPanel();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      const { contentForm, contentInput } = getConfigFileForms();

      contentInput!.value = "{";
      contentInput!.dispatchEvent(new Event("input", { bubbles: true }));
      contentForm!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );

      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/files/subscriptions",
      expect.anything(),
    );
    expect(toastState.error).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
