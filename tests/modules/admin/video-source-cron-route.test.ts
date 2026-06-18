import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const checkVideoSourceValiditiesMock = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/modules/admin/server/video-source-service", () => ({
  checkVideoSourceValidities: checkVideoSourceValiditiesMock,
}));

vi.mock("@/shared/env", () => ({
  env: {
    VIDEO_SOURCE_DELETE_INVALID_ON_CHECK: true,
  },
}));

describe("video source cron route", () => {
  let route: typeof import("@/app/api/cron/source-check/route");

  beforeEach(() => {
    afterMock.mockReset();
    checkVideoSourceValiditiesMock.mockReset();
  });

  it("returns success immediately and schedules the background validity check", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    expect(route.runtime).toBe("nodejs");
    const response = await route.GET(new Request("http://localhost/api/cron/source-check"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Video source validity check scheduled." });
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        removeInvalidSources: true,
      },
    );
  });

  it("uses the keyword query parameter when scheduling the validity check", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    const response = await route.GET(new Request("http://localhost/api/cron/source-check?keyword=%E6%B5%B7%E8%B4%BC%E7%8E%8B"));

    expect(response.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "海贼王" },
      {
        removeInvalidSources: true,
      },
    );
  });

  it("falls back to the default keyword when the keyword query parameter is blank", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    const response = await route.GET(new Request("http://localhost/api/cron/source-check?keyword=%20%20"));

    expect(response.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        removeInvalidSources: true,
      },
    );
  });
});
