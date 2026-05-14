// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigFilesPanel } from "./config-files-panel";

const toastState = vi.hoisted(() => ({
  danger: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, type }: { children?: ReactNode; type?: "button" | "submit" | "reset" }) => (
    <button type={type ?? "button"}>{children}</button>
  ),
  Card: Object.assign(({ children }: { children?: ReactNode }) => <section>{children}</section>, {
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Chip: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Input: () => <input />,
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  Switch: Object.assign(() => <input type="checkbox" />, {
    Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Thumb: () => <span />,
  }),
  TextArea: () => <textarea />,
  toast: toastState,
}));

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
  toastState.danger.mockReset();
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
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/files");
    expect(toastState.success).toHaveBeenCalledWith("配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("shows a danger toast when the initial config files request fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
    } as Response);

    const root = renderConfigFilesPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastState.danger).toHaveBeenCalledWith("配置读取失败");

    act(() => {
      root.unmount();
    });
  });
});
