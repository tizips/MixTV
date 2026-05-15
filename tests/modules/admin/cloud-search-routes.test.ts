import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cloudSearchRoute from "@/app/api/admin/cloud-search/route";
import * as cloudSearchTypesRoute from "@/app/api/admin/cloud-search/types/route";
import * as cloudSearchTestRoute from "@/app/api/admin/cloud-search/test/route";
import {
  saveCloudSearchConfig,
  testCloudSearchConnection,
} from "@/modules/admin/server/cloud-search-service";

vi.mock("@/modules/admin/server/cloud-search-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/cloud-search-service")>();

  return {
    ...actual,
    saveCloudSearchConfig: vi.fn(),
    testCloudSearchConnection: vi.fn(),
  };
});

describe("cloud search API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the supported drive types from the local PanSou-compatible catalog", async () => {
    const response = await cloudSearchTypesRoute.GET();

    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual([
      { key: "baidu", label: "百度" },
      { key: "aliyun", label: "阿里" },
      { key: "quark", label: "夸克" },
      { key: "tianyi", label: "天翼" },
      { key: "uc", label: "UC" },
      { key: "mobile", label: "移动" },
      { key: "115", label: "115" },
      { key: "123", label: "123" },
      { key: "xunlei", label: "迅雷" },
      { key: "pikpak", label: "PikPak" },
      { key: "guangya", label: "光鸭" },
      { key: "magnet", label: "磁力" },
      { key: "ed2k", label: "电驴" },
      { key: "other", label: "其他" },
    ]);
  });

  it("rejects unsupported cloud search config fields before saving", async () => {
    const response = await cloudSearchRoute.POST(
      new Request("http://localhost/api/admin/cloud-search", {
        body: JSON.stringify({
          enabled: true,
          panSouUrl: "https://so.252035.xyz",
          requestTimeoutSeconds: 10,
          supportedDriveTypes: ["baidu"],
          unexpected: true,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(saveCloudSearchConfig).not.toHaveBeenCalled();
  });

  it("rejects invalid cloud search test urls before testing", async () => {
    const response = await cloudSearchTestRoute.POST(
      new Request("http://localhost/api/admin/cloud-search/test", {
        body: JSON.stringify({ panSouUrl: "not a url" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "请输入有效的 PanSou 服务地址。" });
    expect(testCloudSearchConnection).not.toHaveBeenCalled();
  });

  it("passes the default PanSou URL to cloud search APIs when the url is blank", async () => {
    vi.mocked(saveCloudSearchConfig).mockResolvedValueOnce({
      enabled: true,
      panSouUrl: "https://so.252035.xyz",
      requestTimeoutSeconds: 10,
      supportedDriveTypes: ["baidu"],
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    vi.mocked(testCloudSearchConnection).mockResolvedValueOnce({
      checkedAt: "2026-05-15T00:00:00.000Z",
      message: "PanSou endpoint accepted: https://so.252035.xyz",
      ok: true,
    });

    const saveResponse = await cloudSearchRoute.POST(
      new Request("http://localhost/api/admin/cloud-search", {
        body: JSON.stringify({
          enabled: true,
          panSouUrl: " ",
          requestTimeoutSeconds: 10,
          supportedDriveTypes: ["baidu"],
        }),
        method: "POST",
      }),
    );
    const testResponse = await cloudSearchTestRoute.POST(
      new Request("http://localhost/api/admin/cloud-search/test", {
        body: JSON.stringify({ panSouUrl: "" }),
        method: "POST",
      }),
    );

    expect(saveResponse.status).toBe(200);
    expect(testResponse.status).toBe(200);
    expect(saveCloudSearchConfig).toHaveBeenCalledWith({
      enabled: true,
      panSouUrl: "https://so.252035.xyz",
      requestTimeoutSeconds: 10,
      supportedDriveTypes: ["baidu"],
    });
    expect(testCloudSearchConnection).toHaveBeenCalledWith({ panSouUrl: "https://so.252035.xyz" });
  });
});
