// @vitest-environment happy-dom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { LoginForm } from "./login-form";

const routerState = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerState,
}));

vi.mock("next-auth/react", () => ({
  signIn: authState.signIn,
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    isDisabled,
    type,
  }: {
    children: ReactNode | ((props: { isPending: boolean }) => ReactNode);
    isDisabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button disabled={isDisabled} type={type}>
      {typeof children === "function" ? children({ isPending: Boolean(isDisabled) }) : children}
    </button>
  ),
  Card: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Description: ({ children }: { children: ReactNode }) => <p>{children}</p>,
      Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
    },
  ),
  Form: ({
    action,
    children,
  }: {
    action: (formData: FormData) => void;
    children: ReactNode;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        action(new FormData(event.currentTarget));
      }}
    >
      {children}
    </form>
  ),
  Input: ({
    id,
    name,
    onChange,
    placeholder,
    required,
    type,
    value,
  }: {
    id?: string;
    name?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    required?: boolean;
    type?: string;
    value?: string;
  }) => (
    <input
      id={id}
      name={name}
      onChange={(event) => {
        onChange?.({ target: { value: event.currentTarget.value } });
      }}
      onInput={(event) => {
        onChange?.({ target: { value: event.currentTarget.value } });
      }}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  ),
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  Spinner: () => <span>loading</span>,
  TextField: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderLoginForm() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<LoginForm nextPath="/search" />);
  });

  return { host, root };
}

beforeEach(() => {
  authState.signIn.mockReset();
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
      redirectTo: "/search",
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

  it("navigates when sign-in succeeds", async () => {
    authState.signIn.mockResolvedValue({
      code: undefined,
      error: undefined,
      ok: true,
      status: 200,
      url: "/search",
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

    expect(routerState.replace).toHaveBeenCalledWith("/search");
    expect(routerState.refresh).toHaveBeenCalled();
    expect(host.textContent).not.toContain("Incorrect username or password.");

    act(() => {
      root.unmount();
    });
  });
});
