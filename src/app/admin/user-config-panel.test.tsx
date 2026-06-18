// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAntdMock } from "@/test/antd-mock";
import { UserConfigPanel, resetUserConfigPanelState } from "./user-config-panel";

const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("antd", () => createAntdMock({ message: toastState }));

function renderUserConfigPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<UserConfigPanel />);
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

function clickButtonByText(host: HTMLElement, text: string) {
  const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  button?.click();
}

function getAddUserFields(host: HTMLElement) {
  const roleSelect = host.querySelector<HTMLSelectElement>('select[name="role"]');
  const form = roleSelect?.closest("form") as HTMLFormElement | null;

  return {
    form,
    passwordConfirmInput: form?.querySelector<HTMLInputElement>(
      'input[name="passwordConfirm"]',
    ),
    passwordInput: form?.querySelector<HTMLInputElement>('input[name="password"]'),
    usernameInput: form?.querySelector<HTMLInputElement>('input[name="username"]'),
  };
}

function getPasswordFields(host: HTMLElement) {
  const usernameInput = host.querySelector<HTMLInputElement>(
    'input[name="username"]:disabled',
  );
  const form = usernameInput?.closest("form") as HTMLFormElement | null;

  return {
    form,
    passwordConfirmInput: form?.querySelector<HTMLInputElement>(
      'input[name="passwordConfirm"]',
    ),
    passwordInput: form?.querySelector<HTMLInputElement>('input[name="password"]'),
    usernameInput,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  resetUserConfigPanelState();
  toastState.error.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("UserConfigPanel", () => {
  it("loads users from the admin users API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    for (let index = 0; index < 5 && toastState.success.mock.calls.length === 0; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users");
    expect(host.textContent).toContain("carol");
    expect(toastState.success).toHaveBeenCalledWith("用户配置已加载");

    act(() => {
      root.unmount();
    });
  });

  it("keeps a blocked add user submission in the add dialog", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      clickButtonByText(host, "添加用户");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const { form: addForm, passwordInput, usernameInput } = getAddUserFields(host);

    await act(async () => {
      if (usernameInput) {
        changeInputValue(usernameInput, "draft-user");
      }
      if (passwordInput) {
        changeInputValue(passwordInput, "Draft123");
      }
      addForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usernameInput?.value).toBe("draft-user");
    expect(passwordInput?.value).toBe("Draft123");

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).not.toContain("两次输入的密码不一致。");

    act(() => {
      root.unmount();
    });
  });

  it("keeps the initial password hidden in the add user form", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      clickButtonByText(host, "添加用户");
      await Promise.resolve();
      await Promise.resolve();
    });

    const { passwordInput } = getAddUserFields(host);
    expect(passwordInput?.type).toBe("password");
    expect(host.querySelector('button[aria-label="查看初始密码"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("keeps create user API validation messages out of the add dialog", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          updatedAt: null,
          users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ message: "用户名至少需要 4 个字符。" }),
        ok: false,
        status: 400,
      } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      clickButtonByText(host, "添加用户");
      await Promise.resolve();
      await Promise.resolve();
    });

    const {
      form: addForm,
      passwordConfirmInput,
      passwordInput,
      usernameInput,
    } = getAddUserFields(host);

    await act(async () => {
      if (usernameInput) {
        changeInputValue(usernameInput, "carol");
      }
      if (passwordInput) {
        changeInputValue(passwordInput, "Secret123");
      }
      if (passwordConfirmInput) {
        changeInputValue(passwordConfirmInput, "Secret123");
      }
      addForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    for (let index = 0; index < 5 && toastState.error.mock.calls.length === 0; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(host.textContent).not.toContain("用户名至少需要 4 个字符。");
    expect(usernameInput?.value).toBe("carol");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toastState.error).toHaveBeenCalledWith("用户名至少需要 4 个字符。");

    act(() => {
      root.unmount();
    });
  });

  it("validates add user credential formats before calling the create API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    await act(async () => {
      clickButtonByText(host, "添加用户");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const {
      form: addForm,
      passwordConfirmInput,
      passwordInput,
      usernameInput,
    } = getAddUserFields(host);

    await act(async () => {
      if (usernameInput) {
        changeInputValue(usernameInput, "Carol");
      }
      if (passwordInput) {
        changeInputValue(passwordInput, "Secret123");
      }
      if (passwordConfirmInput) {
        changeInputValue(passwordConfirmInput, "Secret123");
      }
      addForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(usernameInput?.value).toBe("Carol");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastState.error).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("shows server validation messages and rolls back failed role updates", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          updatedAt: null,
          users: [{ username: "carol", role: "user", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ message: "至少需要保留一位站长。" }),
        ok: false,
        status: 400,
      } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("普通用户");

    act(() => {
      root.unmount();
    });
  });

  it("asks for confirmation before deleting a user", async () => {
    const fetchMock = vi.mocked(fetch);
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmMock);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "user", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      host.querySelectorAll("button")[4]?.click();
      await Promise.resolve();
    });

    expect(confirmMock).toHaveBeenCalledWith("确定删除用户 carol 吗？此操作无法撤销。");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("carol");

    act(() => {
      root.unmount();
    });
  });

  it("opens the add user dialog through the primary action", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        updatedAt: null,
        users: [{ username: "carol", role: "owner", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
      }),
      ok: true,
    } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      clickButtonByText(host, "添加用户");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("saves a user's changed password through the user patch API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          updatedAt: null,
          users: [{ username: "carol", role: "user", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }],
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          updatedAt: "2026-05-14T01:00:00.000Z",
          users: [
            {
              username: "carol",
              role: "user",
              status: "active",
              createdAt: "2026-05-14T00:00:00.000Z",
              updatedAt: "2026-05-14T01:00:00.000Z",
            },
          ],
        }),
        ok: true,
      } as Response);

    const { host, root } = renderUserConfigPanel();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      host.querySelectorAll("button")[1]?.click();
      await Promise.resolve();
    });

    const {
      form: passwordForm,
      passwordConfirmInput,
      passwordInput,
    } = getPasswordFields(host);
    await act(async () => {
      if (passwordInput) {
        changeInputValue(passwordInput, "Newsecret1");
      }
      if (passwordConfirmInput) {
        changeInputValue(passwordConfirmInput, "Newsecret1");
      }
      passwordForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users/carol", {
      body: JSON.stringify({ password: "Newsecret1" }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    expect(toastState.success).toHaveBeenLastCalledWith("用户密码已修改");

    act(() => {
      root.unmount();
    });
  });
});
