// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { signOut } from "next-auth/react";
import { UserMenu } from "./user-menu";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch ?? true)} href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("antd", () => {
  function Button({ children, className, icon, onClick, type }: { children: ReactNode; className?: string; icon?: ReactNode; onClick?: () => void; type?: string }) {
    return (
      <button className={className} type={type === "primary" ? "button" : "button"} onClick={onClick}>
        {icon}
        {children}
      </button>
    );
  }

  function Divider() {
    return <hr />;
  }

  function Dropdown({
    children,
    popupRender,
    menu,
  }: {
    children: ReactNode;
    popupRender?: (menu: ReactNode) => ReactNode;
    menu?: { items?: Array<{ key: string; label: ReactNode }>; onClick?: () => void };
  }) {
    const renderedMenu = (
      <ul aria-label="个人中心菜单" role="menu">
        {menu?.items?.map((item) => (
          <li key={item.key} role="menuitem" onClick={() => menu?.onClick?.()}>
            {item.label}
          </li>
        ))}
      </ul>
    );

    return (
      <div data-testid="dropdown">
        {children}
        {popupRender ? popupRender(renderedMenu) : renderedMenu}
      </div>
    );
  }

  function Modal({
    children,
    footer,
    open,
    title,
  }: {
    children: ReactNode;
    footer?: ReactNode;
    open?: boolean;
    title?: ReactNode;
  }) {
    if (!open) {
      return null;
    }

    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
        <div>{footer}</div>
      </div>
    );
  }

  function Tag({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={className}>{children}</span>;
  }

  function TypographyText({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={className}>{children}</span>;
  }

  function TypographyTitle({ children, className }: { children: ReactNode; className?: string }) {
    return <h2 className={className}>{children}</h2>;
  }

  return {
    Button,
    Divider,
    Dropdown,
    Modal,
    Tag,
    Typography: {
      Text: TypographyText,
      Title: TypographyTitle,
    },
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("UserMenu", () => {
  it("loads the history update count and renders it on the history action", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/history/update-count") {
        return new Response(JSON.stringify({ history: 3 }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<UserMenu userName="橘子" isAdmin />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/history/update-count", { cache: "no-store" });
    expect(host.innerHTML).toContain("继续观看");
    expect(host.innerHTML).toContain(">3<");
    expect(host.innerHTML).not.toContain("更新提醒");
    expect(host.innerHTML).toContain("我的收藏");
    expect(host.innerHTML).not.toContain("版本信息");
    expect(host.querySelectorAll("button button")).toHaveLength(0);
    expect(host.querySelector('a[href="/settings"]')).not.toBeNull();
    expect(host.querySelector('a[href="/history"]')).not.toBeNull();
    expect(host.querySelector('a[href="/favorites"]')).not.toBeNull();
    expect(host.querySelector('a[data-prefetch="false"][href="/settings"]')).not.toBeNull();
    expect(host.querySelector('a[data-prefetch="false"][href="/history"]')).not.toBeNull();
    expect(host.querySelector('a[data-prefetch="false"][href="/favorites"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("logs out through the local logout API instead of NextAuth client signOut", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/history/update-count") {
        return new Response(JSON.stringify({ history: 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (String(input) === "/api/logout") {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    const locationAssignMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { assign: locationAssignMock });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<UserMenu userName="橘子" isAdmin />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const logoutButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("登出") && !button.textContent?.includes("确认"),
    );

    expect(logoutButton).not.toBeUndefined();

    await act(async () => {
      logoutButton?.click();
      await Promise.resolve();
    });

    const confirmButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("确认登出"),
    );

    expect(confirmButton).not.toBeUndefined();

    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/logout", { method: "POST" });
    expect(locationAssignMock).toHaveBeenCalledWith("/login");
    expect(signOut).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
