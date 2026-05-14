import { beforeEach, describe, expect, it, vi } from "vitest";
import * as autoUpdateRoute from "@/app/api/admin/files/subscription/auto-update/route";
import * as contentRoute from "@/app/api/admin/files/content/route";
import * as pullRoute from "@/app/api/admin/files/subscription/pull/route";
import {
  saveConfigFilesContent,
  saveConfigFilesSubscriptionAutoUpdate,
  saveConfigFilesSubscriptionPull,
} from "@/modules/admin";

vi.mock("@/modules/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin")>();

  return {
    ...actual,
    saveConfigFilesContent: vi.fn(),
    saveConfigFilesSubscriptionAutoUpdate: vi.fn(),
    saveConfigFilesSubscriptionPull: vi.fn(),
  };
});

describe("config files API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported config content fields before saving", async () => {
    const response = await contentRoute.POST(
      new Request("http://localhost/api/admin/files/content", {
        body: JSON.stringify({ content: "{}", unexpected: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesContent).not.toHaveBeenCalled();
  });

  it("rejects blank config content before saving", async () => {
    const response = await contentRoute.POST(
      new Request("http://localhost/api/admin/files/content", {
        body: JSON.stringify({ content: "   " }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请输入配置内容。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesContent).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON config content before saving", async () => {
    const response = await contentRoute.POST(
      new Request("http://localhost/api/admin/files/content", {
        body: JSON.stringify({ content: "{ invalid" }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "配置内容必须是有效 JSON。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesContent).not.toHaveBeenCalled();
  });

  it("rejects invalid subscription pull URLs before pulling", async () => {
    const response = await pullRoute.POST(
      new Request("http://localhost/api/admin/files/subscription/pull", {
        body: JSON.stringify({ url: "not a url" }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请输入有效的订阅链接。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesSubscriptionPull).not.toHaveBeenCalled();
  });

  it("rejects unsupported auto-update fields before saving", async () => {
    const response = await autoUpdateRoute.POST(
      new Request("http://localhost/api/admin/files/subscription/auto-update", {
        body: JSON.stringify({ autoUpdate: true, unexpected: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesSubscriptionAutoUpdate).not.toHaveBeenCalled();
  });
});
