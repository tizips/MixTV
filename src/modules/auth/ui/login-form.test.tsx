// @vitest-environment happy-dom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { createAntdMock } from "@/test/antd-mock";
import { LoginForm } from "./login-form";

const routerState = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

const navigationState = vi.hoisted(() => ({
  search: "",
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    routerState.replace(url);
  }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
  useRouter: () => routerState,
}));

vi.mock("next-auth/react", () => ({
  signIn: authState.signIn,
}));

vi.mock("antd", () => createAntdMock());

function renderLoginForm() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<LoginForm />);
  });

  return { host, root };
}

beforeEach(() => {
  authState.signIn.mockReset();
  navigationState.search = "";
  routerState.refresh.mockReset();
  routerState.replace.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("LoginForm", () => {
  it("shows an inline error when credentials are rejected", async () => {
    authState.signIn.mockResolvedValue({
      code: "credentials",
      error: "CredentialsSignin",
      ok: true,
      status: 200,
      url: null,
    });

    const { host, root } = renderLoginForm();
    const form = host.querySelector("form");
    const username = host.querySelector("#login-username") as HTMLInputElement | null;
    const password = host.querySelector("#login-password") as HTMLInputElement | null;

    if (!form || !username || !password) {
      throw new Error("Login form elements were not rendered");
    }

    await act(async () => {
      username.value = "test";
      username.dispatchEvent(new Event("input", { bubbles: true }));
      username.dispatchEvent(new Event("change", { bubbles: true }));
      password.value = "test";
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authState.signIn).toHaveBeenCalledWith("credentials", {
      password: "test",
      redirect: false,
      redirectTo: "/",
      username: "test",
    });
    const currentUsername = host.querySelector("#login-username") as HTMLInputElement | null;
    const currentPassword = host.querySelector("#login-password") as HTMLInputElement | null;

    expect(host.textContent).toContain("Incorrect username or password.");
    expect(currentUsername?.value).toBe("test");
    expect(currentPassword?.value).toBe("test");
    expect(routerState.replace).not.toHaveBeenCalled();
    expect(routerState.refresh).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("redirects home after sign-in succeeds without a next path", async () => {
    authState.signIn.mockResolvedValue({
      code: undefined,
      error: undefined,
      ok: true,
      status: 200,
      url: "/",
    });

    const { host, root } = renderLoginForm();
    const form = host.querySelector("form");
    const username = host.querySelector("#login-username") as HTMLInputElement | null;
    const password = host.querySelector("#login-password") as HTMLInputElement | null;

    if (!form || !username || !password) {
      throw new Error("Login form elements were not rendered");
    }

    await act(async () => {
      username.value = "orange";
      username.dispatchEvent(new Event("input", { bubbles: true }));
      username.dispatchEvent(new Event("change", { bubbles: true }));
      password.value = "secret";
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authState.signIn).toHaveBeenCalledWith("credentials", {
      password: "secret",
      redirect: false,
      redirectTo: "/",
      username: "orange",
    });
    expect(routerState.replace).toHaveBeenCalledWith("/");
    expect(routerState.refresh).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Incorrect username or password.");

    act(() => {
      root.unmount();
    });
  });

  it("redirects to the safe next path after sign-in succeeds", async () => {
    navigationState.search = "next=/stats";
    authState.signIn.mockResolvedValue({
      code: undefined,
      error: undefined,
      ok: true,
      status: 200,
      url: "/stats",
    });

    const { host, root } = renderLoginForm();
    const form = host.querySelector("form");
    const username = host.querySelector("#login-username") as HTMLInputElement | null;
    const password = host.querySelector("#login-password") as HTMLInputElement | null;

    if (!form || !username || !password) {
      throw new Error("Login form elements were not rendered");
    }

    await act(async () => {
      username.value = "orange";
      username.dispatchEvent(new Event("input", { bubbles: true }));
      username.dispatchEvent(new Event("change", { bubbles: true }));
      password.value = "secret";
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authState.signIn).toHaveBeenCalledWith("credentials", {
      password: "secret",
      redirect: false,
      redirectTo: "/stats",
      username: "orange",
    });
    expect(routerState.replace).toHaveBeenCalledWith("/stats");
    expect(routerState.refresh).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("normalizes unsafe next paths before credentials sign-in", async () => {
    navigationState.search = "next=//evil.example";
    authState.signIn.mockResolvedValue({
      code: undefined,
      error: undefined,
      ok: true,
      status: 200,
      url: "/",
    });

    const { host, root } = renderLoginForm();
    const form = host.querySelector("form");
    const username = host.querySelector("#login-username") as HTMLInputElement | null;
    const password = host.querySelector("#login-password") as HTMLInputElement | null;

    if (!form || !username || !password) {
      throw new Error("Login form elements were not rendered");
    }

    await act(async () => {
      username.value = "orange";
      username.dispatchEvent(new Event("input", { bubbles: true }));
      username.dispatchEvent(new Event("change", { bubbles: true }));
      password.value = "secret";
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authState.signIn).toHaveBeenCalledWith("credentials", {
      password: "secret",
      redirect: false,
      redirectTo: "/",
      username: "orange",
    });
    expect(routerState.replace).toHaveBeenCalledWith("/");

    act(() => {
      root.unmount();
    });
  });
});
