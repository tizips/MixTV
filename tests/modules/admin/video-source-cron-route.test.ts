import { beforeEach, describe, expect, it, vi } from "vitest";

const checkVideoSourceValiditiesMock = vi.fn();

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

  it("returns the validity result after the scheduled validity check completes", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    const result = {
      sources: [
        {
          adult: false,
          apiUrl: "https://example.com/api",
          key: "example",
          name: "Example",
          no: 1,
          status: "active",
          type: "json",
          updatedAt: "2026-06-20T00:00:00.000Z",
          validity: "valid",
          weight: 50,
        },
      ],
    };
    let finishCheck: (() => void) | undefined;

    checkVideoSourceValiditiesMock.mockReturnValue(
      new Promise<typeof result>((resolve) => {
        finishCheck = resolve;
      }).then(() => result),
    );

    expect(route.runtime).toBe("nodejs");
    expect(route.maxDuration).toBe(120);

    const responsePromise = route.GET(new Request("http://localhost/api/cron/source-check"));
    const pendingResponse = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    expect(pendingResponse).toBe("not returned");

    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        concurrency: 10,
        removeInvalidSources: true,
      },
    );
    finishCheck?.();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Video source validity check completed.",
      result,
    });
  });

  it("uses the keyword query parameter when running the validity check", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    checkVideoSourceValiditiesMock.mockResolvedValue({ sources: [] });

    const response = await route.GET(new Request("http://localhost/api/cron/source-check?keyword=%E6%B5%B7%E8%B4%BC%E7%8E%8B"));

    expect(response.status).toBe(200);
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "海贼王" },
      {
        concurrency: 10,
        removeInvalidSources: true,
      },
    );
  });

  it("falls back to the default keyword when the keyword query parameter is blank", async () => {
    route ??= await import("@/app/api/cron/source-check/route");
    checkVideoSourceValiditiesMock.mockResolvedValue({ sources: [] });

    const response = await route.GET(new Request("http://localhost/api/cron/source-check?keyword=%20%20"));

    expect(response.status).toBe(200);
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "斗罗大陆" },
      {
        concurrency: 10,
        removeInvalidSources: true,
      },
    );
  });
});
