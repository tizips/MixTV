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

  it("clears the add user form every time the add dialog opens", async () => {
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

    const addForm = host.querySelector("#add-user-form") as HTMLFormElement | null;
    const usernameInput = addForm?.querySelector('input[autocomplete="username"]') as HTMLInputElement | null;
    const passwordInput = addForm?.querySelector('input[type="password"]') as HTMLInputElement | null;

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

    expect(host.textContent).toContain("请再次输入初始密码。");

    await act(async () => {
      clickButtonByText(host, "取消");
      await Promise.resolve();
    });
    await act(async () => {
      clickButtonByText(host, "添加用户");
      await Promise.resolve();
      await Promise.resolve();
    });

    const reopenedForm = host.querySelector("#add-user-form") as HTMLFormElement | null;
    const reopenedUsernameInput = reopenedForm?.querySelector('input[autocomplete="username"]') as HTMLInputElement | null;
    const reopenedPasswordInput = reopenedForm?.querySelector('input[type="password"]') as HTMLInputElement | null;

    expect(reopenedUsernameInput?.value).toBe("");
    expect(reopenedPasswordInput?.value).toBe("");
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

    const addForm = host.querySelector("#add-user-form") as HTMLFormElement | null;
    const passwordInput = addForm?.querySelector('input[autocomplete="new-password"]') as HTMLInputElement | null;
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

    const addForm = host.querySelector("#add-user-form") as HTMLFormElement | null;
    const usernameInput = addForm?.querySelector('input[autocomplete="username"]') as HTMLInputElement | null;
    const passwordInputs = addForm?.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');

    await act(async () => {
      if (usernameInput) {
        changeInputValue(usernameInput, "carol");
      }
      if (passwordInputs?.[0]) {
        changeInputValue(passwordInputs[0], "Secret123");
      }
      if (passwordInputs?.[1]) {
        changeInputValue(passwordInputs[1], "Secret123");
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

    const addForm = host.querySelector("#add-user-form") as HTMLFormElement | null;
    const usernameInput = addForm?.querySelector('input[autocomplete="username"]') as HTMLInputElement | null;
    const passwordInputs = addForm?.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');

    await act(async () => {
      if (usernameInput) {
        changeInputValue(usernameInput, "Carol");
      }
      if (passwordInputs?.[0]) {
        changeInputValue(passwordInputs[0], "Secret123");
      }
      if (passwordInputs?.[1]) {
        changeInputValue(passwordInputs[1], "Secret123");
      }
      addForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.textContent).toContain("用户名需为 4-20 位小写字母或数字。");
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    });

    const passwordForm = host.querySelector("#change-password-form") as HTMLFormElement | null;
    const passwordInputs = passwordForm?.querySelectorAll<HTMLInputElement>('input[type="password"]');
    await act(async () => {
      if (passwordInputs?.[0]) {
        changeInputValue(passwordInputs[0], "Newsecret1");
      }
      if (passwordInputs?.[1]) {
        changeInputValue(passwordInputs[1], "Newsecret1");
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
