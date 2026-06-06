import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scriptMock = vi.fn(async (script: string) => {
  if (script.includes("HGETALL")) {
    return [
      "page:10:20:count",
      "2",
      "page:10:20:duration",
      "4500",
      "page:10:20:success",
      "0",
      "page:10:20:fail",
      "0",
      "api:10:20:count",
      "3",
      "api:10:20:duration",
      "900",
      "api:10:20:success",
      "2",
      "api:10:20:fail",
      "1",
      "third-party:10:20:count",
      "4",
      "third-party:10:20:duration",
      "2600",
      "third-party:10:20:success",
      "3",
      "third-party:10:20:fail",
      "1",
    ];
  }

  return 1;
});

vi.mock("@/infrastructure/db/db-adapter", () => ({
  createDbAdapter: () => ({
    del: vi.fn(),
    get: vi.fn(),
    script: scriptMock,
    set: vi.fn(),
  }),
}));

import {
  formatDurationMs,
  getTrafficOverview,
  getTrafficSnapshot,
  recordApiRequest,
  recordPageVisit,
  recordThirdPartyRequest,
  resetStatsStoreForTest,
} from "./stats-service";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-16T10:20:30.000Z"));
  scriptMock.mockClear();
  resetStatsStoreForTest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("stats-service", () => {
  it("records page visits in the current minute bucket", async () => {
    await recordPageVisit();

    expect(scriptMock).toHaveBeenCalledWith(
      expect.stringContaining("HINCRBY"),
      {
        args: ["page:10:20", 1, 0, 0, 0, 691200],
        keys: ["day:2026-05-16"],
      },
    );
  });

  it("records api and third-party request durations", async () => {
    await recordApiRequest({ durationMs: 123, ok: true });
    await recordThirdPartyRequest({ durationMs: 456, ok: false });

    expect(scriptMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("HINCRBY"),
      {
        args: ["api:10:20", 1, 123, 1, 0, 691200],
        keys: ["day:2026-05-16"],
      },
    );
    expect(scriptMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("HINCRBY"),
      {
        args: ["third-party:10:20", 1, 456, 0, 1, 691200],
        keys: ["day:2026-05-16"],
      },
    );
  });

  it("reads the current minute snapshot from redis hash data", async () => {
    const snapshot = await getTrafficSnapshot();

    expect(snapshot.minuteKey).toBe("2026-05-16 10:20");
    expect(snapshot.page).toEqual({
      averageDurationMs: 2250,
      count: 2,
      failCount: 0,
      successCount: 0,
      totalDurationMs: 4500,
    });
    expect(snapshot.api).toEqual({
      averageDurationMs: 300,
      count: 3,
      failCount: 1,
      successCount: 2,
      totalDurationMs: 900,
    });
    expect(snapshot.thirdParty).toEqual({
      averageDurationMs: 650,
      count: 4,
      failCount: 1,
      successCount: 3,
      totalDurationMs: 2600,
    });
  });

  it("returns an empty traffic overview when KV reads fail", async () => {
    scriptMock.mockRejectedValue(new Error("KV binding is unavailable."));

    const overview = await getTrafficOverview({
      dayCount: 2,
      timelineMinutes: 3,
    });

    expect(overview.currentMinute.page.count).toBe(0);
    expect(overview.dailySummaries).toHaveLength(2);
    expect(overview.timeline).toHaveLength(3);
    expect(overview.dailySummaries[0]?.page.count).toBe(0);
    expect(overview.timeline[0]?.api.count).toBe(0);
  });

  it("formats durations for the admin dashboard", () => {
    expect(formatDurationMs(0)).toBe("0ms");
    expect(formatDurationMs(850)).toBe("850ms");
    expect(formatDurationMs(1250)).toBe("1.25s");
  });
});
