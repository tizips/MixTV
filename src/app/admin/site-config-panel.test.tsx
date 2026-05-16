// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteConfigPanel } from "./site-config-panel";
import { env } from "@/shared/env";

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
  Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  Form: ({
    children,
    onSubmit,
  }: {
    children?: ReactNode;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
  }) => <form onSubmit={onSubmit}>{children}</form>,
  Input: () => <input />,
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  ListBox: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Select: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Indicator: () => <span />,
    Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Value: () => <span />,
  }),
  Switch: Object.assign(() => <input type="checkbox" />, {
    Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Thumb: () => <span />,
  }),
  TextArea: () => <textarea />,
  TextField: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  toast: toastState,
}));

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
  toastState.danger.mockReset();
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastState.danger).toHaveBeenCalledWith("站点配置读取失败");

    act(() => {
      root.unmount();
    });
  });
});
