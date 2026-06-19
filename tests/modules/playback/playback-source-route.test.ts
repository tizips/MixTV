import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/play/sources/route";

const authMock = vi.hoisted(() => vi.fn());
const getPlaybackSourcesMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/playback/server/playback-source-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/playback/server/playback-source-service")>();

  return {
    ...actual,
    getPlaybackSources: getPlaybackSourcesMock,
  };
});

describe("playback source API route", () => {
  beforeEach(() => {
    authMock.mockReset();
    getPlaybackSourcesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("streams playback source results as SSE", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlaybackSourcesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 1 });
      options.onResult?.({
        id: "80474",
        key: "alpha",
        name: "Alpha Source",
        ping: 72,
        probe_url: "https://alpha.test/api.php/provide/vod",
        quality: "1080P",
        source_name: "Alpha Source",
        total_episodes: 2,
      });
      return { completed: 1, total: 1 };
    });

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸&keyword=深空彼岸"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: start");
    expect(body).toContain('"total":1');
    expect(body).toContain("event: result");
    expect(body).toContain('"key":"alpha"');
    expect(body).toContain('"probe_url":"https://alpha.test/api.php/provide/vod"');
    expect(body).not.toContain('"ping"');
    expect(body).toContain("event: complete");
    expect(getPlaybackSourcesMock).toHaveBeenCalledWith(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      expect.objectContaining({
        onResult: expect.any(Function),
        onStart: expect.any(Function),
      }),
    );
  });

  it("requires keyword", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "keyword is required." });
    expect(getPlaybackSourcesMock).not.toHaveBeenCalled();
  });

  it("streams an error event when playback source lookup times out", async () => {
    vi.useFakeTimers();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlaybackSourcesMock.mockImplementation(async () => new Promise(() => undefined));

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸&keyword=深空彼岸"));
    const bodyPromise = response.text();

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(bodyPromise).resolves.toContain("event: error");
    await expect(bodyPromise).resolves.toContain("Playback source lookup timed out.");
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET(new Request("http://localhost/api/play/sources?index=2026:anime:深空彼岸&keyword=深空彼岸"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized." });
  });

  it("keeps playback source switching out of the source lookup route", () => {
    expect("POST" in route).toBe(false);
  });
});
