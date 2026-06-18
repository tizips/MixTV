// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountGate } from "./account-gate";

const routerState = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const navigationState = vi.hoisted(() => ({
  pathname: "/",
}));

const siteHeaderMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => routerState,
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: (props: {
    accessToken?: string;
    isAdmin?: boolean;
    userName?: string;
  }) => {
    siteHeaderMock(props);

    return (
      <header
        data-access-token={props.accessToken}
        data-is-admin={String(props.isAdmin ?? false)}
        data-testid="site-header"
        data-user-name={props.userName}
      />
    );
  },
}));

function renderAccountGate(
  props: {
    accessToken?: string;
    fallbackIsAdmin?: boolean;
    fallbackUserName?: string;
  } = {},
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <AccountGate
        accessToken={props.accessToken}
        fallbackIsAdmin={props.fallbackIsAdmin ?? false}
        fallbackUserName={props.fallbackUserName ?? "临时用户"}
      >
        <main data-testid="page-child">child</main>
      </AccountGate>,
    );
  });

  return { host, root };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function accountResponse(
  account: { admin?: boolean; name?: string },
  status = 200,
) {
  return new Response(JSON.stringify(account), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  navigationState.pathname = "/";
  routerState.replace.mockReset();
  siteHeaderMock.mockReset();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("AccountGate", () => {
  it("blocks the shell with a full-screen loading page while account info is requested", async () => {
    const fetchMock = vi.fn(async () => accountResponse({ admin: true, name: "管理员" }));
    vi.stubGlobal("fetch", fetchMock);

    const { host, root } = renderAccountGate({ accessToken: "token-1" });

    expect(host.textContent).toContain("正在准备观影空间");
    expect(host.textContent).toContain("即将进入片库");
    expect(host.textContent).not.toContain("登录");
    expect(host.textContent).not.toContain("验证");
    expect(host.querySelector('[data-testid="account-loader-orbit"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="account-loader-scan"]')).not.toBeNull();
    expect(host.textContent).not.toContain("child");

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/account", {
      cache: "no-store",
      headers: {
        authorization: "Bearer token-1",
      },
    });
    expect(host.textContent).toContain("child");
    expect(host.querySelector('[data-testid="site-header"]')).not.toBeNull();
    expect(siteHeaderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "token-1",
        isAdmin: true,
        userName: "管理员",
      }),
    );
    expect(routerState.replace).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("redirects protected pages to login when no access token is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    navigationState.pathname = "/search";
    window.history.replaceState(null, "", "/search?q=mix");

    const { host, root } = renderAccountGate();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerState.replace).toHaveBeenCalledWith("/login?next=%2Fsearch%3Fq%3Dmix");
    expect(host.textContent).toContain("正在准备观影空间");
    expect(host.textContent).not.toContain("child");

    act(() => {
      root.unmount();
    });
  });

  it("redirects protected pages to login when account lookup is rejected", async () => {
    const fetchMock = vi.fn(async () => accountResponse({ message: "Invalid token" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    navigationState.pathname = "/play";
    window.history.replaceState(null, "", "/play?source=alpha&id=movie-1");

    const { root } = renderAccountGate({ accessToken: "expired-token" });

    await act(async () => {
      await flushPromises();
    });

    expect(routerState.replace).toHaveBeenCalledWith(
      "/login?next=%2Fplay%3Fsource%3Dalpha%26id%3Dmovie-1",
    );

    act(() => {
      root.unmount();
    });
  });

  it("does not block or redirect the login page", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    navigationState.pathname = "/login";
    window.history.replaceState(null, "", "/login");

    const { host, root } = renderAccountGate();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerState.replace).not.toHaveBeenCalled();
    expect(host.textContent).toContain("child");
    expect(host.textContent).not.toContain("正在准备观影空间");

    act(() => {
      root.unmount();
    });
  });
});
