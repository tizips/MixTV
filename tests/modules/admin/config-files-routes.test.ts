import { beforeEach, describe, expect, it, vi } from "vitest";
import * as autoUpdateRoute from "@/app/api/admin/files/subscription/auto-update/route";
import * as pullRoute from "@/app/api/admin/files/subscription/pull/route";
import * as subscriptionsRoute from "@/app/api/admin/files/subscriptions/route";
import {
  saveConfigFilesContent,
  saveConfigFilesSubscriptionAutoUpdate,
  saveConfigFilesSubscriptionPull,
} from "@/modules/admin";

const ensureEdgeOneKvBindingsForNodeMock = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/edgeone/node-kv-bindings", () => ({
  ensureEdgeOneKvBindingsForNode: ensureEdgeOneKvBindingsForNodeMock,
}));

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
    const response = await subscriptionsRoute.POST(
      new Request("http://localhost/api/admin/files/subscriptions", {
        body: JSON.stringify({ content: "{}", unexpected: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesContent).not.toHaveBeenCalled();
  });

  it("rejects blank config content before saving", async () => {
    const response = await subscriptionsRoute.POST(
      new Request("http://localhost/api/admin/files/subscriptions", {
        body: JSON.stringify({ content: "   " }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请输入配置内容。" });
    expect(response.status).toBe(400);
    expect(saveConfigFilesContent).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON config content before saving", async () => {
    const response = await subscriptionsRoute.POST(
      new Request("http://localhost/api/admin/files/subscriptions", {
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

  it("initializes EdgeOne KV bindings before pulling remote subscription config", async () => {
    const url = "https://pz.v88.qzz.io?format=2&source=jingjian";
    const subscription = {
      autoUpdate: false,
      updatedAt: "2026-06-06T18:23:49.088Z",
      url,
    };

    vi.mocked(saveConfigFilesSubscriptionPull).mockResolvedValue(subscription);

    const response = await pullRoute.POST(
      new Request("http://localhost/api/admin/files/subscription/pull", {
        body: JSON.stringify({ url }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual(subscription);
    expect(response.status).toBe(200);
    expect(ensureEdgeOneKvBindingsForNodeMock).toHaveBeenCalledOnce();
    expect(saveConfigFilesSubscriptionPull).toHaveBeenCalledWith(url);
    expect(ensureEdgeOneKvBindingsForNodeMock.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(saveConfigFilesSubscriptionPull).mock.invocationCallOrder[0] ?? 0,
    );
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
