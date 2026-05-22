// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { VideoSourcePanel, resetVideoSourcePanelState } from "./video-source-panel";

const toastState = vi.hoisted(() => ({
  danger: vi.fn(),
  rowRenderCount: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

function renderVideoSourcePanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <VideoSourcePanel />
      </StrictMode>,
    );
  });

  return { host, root };
}

function changeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  resetVideoSourcePanelState();
  toastState.danger.mockReset();
  toastState.rowRenderCount.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("VideoSourcePanel", () => {
  it("keeps the source table mounted when opening source modals", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        sources: Array.from({ length: 80 }, (_, index) => ({
          adult: false,
          apiUrl: `https://source-${index}.test/api`,
          key: `source-${index}`,
          name: `Source ${index}`,
          no: index,
          status: "enabled",
          type: "normal",
          updatedAt: null,
          validity: "warning",
          weight: 10,
        })),
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(host.querySelectorAll("tr[data-source-key]").length).toBe(80);

    const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "添加");

    await act(async () => {
      addButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("添加视频源");
    expect(host.querySelectorAll("tr[data-source-key]").length).toBe(80);

    const validityButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("有效性检测"),
    );

    await act(async () => {
      validityButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("有效性检测");
    expect(host.querySelectorAll("tr[data-source-key]").length).toBe(80);

    act(() => {
      root.unmount();
    });
  });

  it("renders source statistics and the collection update time", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        sources: [
          {
            adult: false,
            apiUrl: "https://alpha.test/api",
            key: "alpha",
            name: "Alpha",
            no: 1,
            status: "enabled",
            type: "normal",
            updatedAt: null,
            validity: "valid",
            weight: 10,
          },
          {
            adult: true,
            apiUrl: "https://beta.test/api",
            key: "beta",
            name: "Beta",
            no: 2,
            status: "disabled",
            type: "short-drama",
            updatedAt: null,
            validity: "invalid",
            weight: 20,
          },
        ],
        updatedAt: "2026-05-20T12:30:00.000Z",
      }),
      ok: true,
    } as Response);

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(host.textContent).toContain("视频源统计");
    expect(host.textContent).toContain("Source total");
    expect(host.textContent).toContain("启用 50%");
    expect(host.textContent).toContain("异常 50%");
    expect(host.textContent).toContain("最后更新时间");
    expect(host.textContent).not.toContain("未保存");

    act(() => {
      root.unmount();
    });
  });

  it("disables the key field only when editing an existing video source", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        sources: [
          {
            adult: false,
            apiUrl: "https://alpha.test/api",
            key: "alpha",
            name: "Alpha",
            no: 1,
            status: "enabled",
            type: "normal",
            updatedAt: null,
            validity: "warning",
            weight: 10,
          },
        ],
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    const editButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "编辑");

    await act(async () => {
      editButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    const editingKeyInput = host.querySelector('input[name="sourceKey"]') as HTMLInputElement | null;
    expect(editingKeyInput).not.toBeNull();
    expect(editingKeyInput?.value).toBe("alpha");
    expect(editingKeyInput?.readOnly).toBe(true);

    await act(async () => {
      root.unmount();
    });

    const second = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    const addButton = Array.from(second.host.querySelectorAll("button")).find((button) => button.textContent === "添加");

    await act(async () => {
      addButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    const addingKeyInput = second.host.querySelector('input[name="sourceKey"]') as HTMLInputElement | null;
    expect(addingKeyInput).not.toBeNull();
    expect(addingKeyInput?.disabled).toBe(false);

    act(() => {
      second.root.unmount();
    });
  });

  it("opens a keyword modal and applies streamed validity check results", async () => {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          sources: [
            {
              adult: false,
              apiUrl: "https://alpha.test/api",
              key: "alpha",
              name: "Alpha",
              no: 1,
              status: "enabled",
              type: "normal",
              updatedAt: null,
              validity: "warning",
              weight: 10,
            },
          ],
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          { headers: { "Content-Type": "text/event-stream" }, status: 200 },
        ),
      );

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    const checkButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("有效性检测"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      checkButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    const keywordInput = host.querySelector('input[name="validityKeyword"]') as HTMLInputElement | null;
    expect(keywordInput).not.toBeNull();
    expect(keywordInput?.value).toBe("斗罗大陆");

    await act(async () => {
      changeInputValue(keywordInput!, "movie");
      const dialog = host.querySelector('[role="dialog"]');
      const form = dialog?.querySelector("form") as HTMLFormElement | null;
      form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/video-source/validity-check?keyword=movie", {
      headers: { Accept: "text/event-stream" },
      method: "GET",
    });
    expect(host.textContent).toContain("检测中");

    await act(async () => {
      streamController?.enqueue(
        encoder.encode('event: result\ndata: {"key":"alpha","name":"Alpha","apiUrl":"https://alpha.test/api","validity":"valid"}\n\n'),
      );
      streamController?.close();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("可用");

    act(() => {
      root.unmount();
    });
  });
});
