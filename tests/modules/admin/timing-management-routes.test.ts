import { beforeEach, describe, expect, it, vi } from "vitest";
import * as timingManagementRoute from "@/app/api/admin/timing-management/route";
import { saveTimingManagementConfig } from "@/modules/admin/server/timing-management-service";

vi.mock("@/modules/admin/server/timing-management-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/timing-management-service")>();

  return {
    ...actual,
    saveTimingManagementConfig: vi.fn(),
  };
});

describe("timing management API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported timing management config fields before saving", async () => {
    const response = await timingManagementRoute.POST(
      new Request("http://localhost/api/admin/timing-management", {
        body: JSON.stringify({
          autoRefreshEnabled: true,
          maxRecordsPerRun: 100,
          maxSearchPages: 3,
          onlyRefreshOngoingSeries: true,
          recentActiveDays: 30,
          siteCacheSeconds: 3600,
          unexpected: true,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(saveTimingManagementConfig).not.toHaveBeenCalled();
  });

  it("passes normalized timing management payloads to the service layer", async () => {
    vi.mocked(saveTimingManagementConfig).mockResolvedValueOnce({
      autoRefreshEnabled: true,
      maxRecordsPerRun: 100,
      maxSearchPages: 3,
      onlyRefreshOngoingSeries: true,
      recentActiveDays: 30,
      siteCacheSeconds: 3600,
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    const response = await timingManagementRoute.POST(
      new Request("http://localhost/api/admin/timing-management", {
        body: JSON.stringify({
          autoRefreshEnabled: true,
          maxRecordsPerRun: 100,
          maxSearchPages: 3,
          onlyRefreshOngoingSeries: true,
          recentActiveDays: 30,
          siteCacheSeconds: 3600,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(saveTimingManagementConfig).toHaveBeenCalledWith({
      autoRefreshEnabled: true,
      maxRecordsPerRun: 100,
      maxSearchPages: 3,
      onlyRefreshOngoingSeries: true,
      recentActiveDays: 30,
      siteCacheSeconds: 3600,
    });
  });
});
