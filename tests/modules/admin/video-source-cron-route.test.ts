import { beforeEach, describe, expect, it, vi } from "vitest";

const checkVideoSourceValiditiesMock = vi.fn();
const waitForBackgroundTask = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    checkVideoSourceValiditiesMock.mockReset();
  });

  it("returns success before running the background validity check", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    let finishCheck: (() => void) | undefined;

    checkVideoSourceValiditiesMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishCheck = resolve;
      }),
    );

    expect(route.runtime).toBe("nodejs");
    const responsePromise = route.GET(new Request("http://localhost/api/cron/source-check"));
    const response = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    if (!(response instanceof Response)) {
      throw new Error("source-check cron response did not return before the background task finished.");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Video source validity check scheduled." });
    expect(checkVideoSourceValiditiesMock).not.toHaveBeenCalled();

    await waitForBackgroundTask();
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        removeInvalidSources: true,
      },
    );
    finishCheck?.();
  });

  it("uses the keyword query parameter when scheduling the validity check", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    const response = await route.GET(new Request("http://localhost/api/cron/source-check?keyword=%E6%B5%B7%E8%B4%BC%E7%8E%8B"));

    expect(response.status).toBe(200);
    expect(checkVideoSourceValiditiesMock).not.toHaveBeenCalled();

    await waitForBackgroundTask();
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
    expect(checkVideoSourceValiditiesMock).not.toHaveBeenCalled();

    await waitForBackgroundTask();
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        removeInvalidSources: true,
      },
    );
  });
});
