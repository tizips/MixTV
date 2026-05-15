import { beforeEach, describe, expect, it, vi } from "vitest";
import * as danmakuRoute from "@/app/api/admin/danmaku/route";
import * as danmakuTestRoute from "@/app/api/admin/danmaku/test/route";
import {
  saveDanmakuConfig,
  testDanmakuConnection,
} from "@/modules/admin/server/danmaku-service";

vi.mock("@/modules/admin/server/danmaku-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/danmaku-service")>();

  return {
    ...actual,
    saveDanmakuConfig: vi.fn(),
    testDanmakuConnection: vi.fn(),
  };
});

describe("danmaku API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported danmaku config fields before saving", async () => {
    const response = await danmakuRoute.POST(
      new Request("http://localhost/api/admin/danmaku", {
        body: JSON.stringify({
          enabled: true,
          apiToken: "secret-token",
          apiUrl: "https://danmaku.test",
          requestTimeoutSeconds: 10,
          unexpected: true,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(saveDanmakuConfig).not.toHaveBeenCalled();
  });

  it("rejects invalid danmaku test urls before testing", async () => {
    const response = await danmakuTestRoute.POST(
      new Request("http://localhost/api/admin/danmaku/test", {
        body: JSON.stringify({ apiToken: "secret-token", apiUrl: "not a url" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "请输入有效的弹幕服务地址。" });
    expect(testDanmakuConnection).not.toHaveBeenCalled();
  });

  it("passes normalized danmaku payloads to the service layer", async () => {
    vi.mocked(saveDanmakuConfig).mockResolvedValueOnce({
      enabled: true,
      apiToken: "secret-token",
      apiUrl: "https://danmaku.test",
      requestTimeoutSeconds: 10,
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    vi.mocked(testDanmakuConnection).mockResolvedValueOnce({
      checkedAt: "2026-05-15T00:00:00.000Z",
      message: "Danmaku endpoint accepted: https://danmaku.test",
      ok: true,
    });

    const saveResponse = await danmakuRoute.POST(
      new Request("http://localhost/api/admin/danmaku", {
        body: JSON.stringify({
          enabled: true,
          apiToken: " secret-token ",
          apiUrl: " https://danmaku.test ",
          requestTimeoutSeconds: 10,
        }),
        method: "POST",
      }),
    );
    const testResponse = await danmakuTestRoute.POST(
      new Request("http://localhost/api/admin/danmaku/test", {
        body: JSON.stringify({ apiToken: " secret-token ", apiUrl: " https://danmaku.test " }),
        method: "POST",
      }),
    );

    expect(saveResponse.status).toBe(200);
    expect(testResponse.status).toBe(200);
    expect(saveDanmakuConfig).toHaveBeenCalledWith({
      enabled: true,
      apiToken: "secret-token",
      apiUrl: "https://danmaku.test",
      requestTimeoutSeconds: 10,
    });
    expect(testDanmakuConnection).toHaveBeenCalledWith({
      apiToken: "secret-token",
      apiUrl: "https://danmaku.test",
    });
  });
});
