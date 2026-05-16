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
    const response = await route.GET();

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
});
