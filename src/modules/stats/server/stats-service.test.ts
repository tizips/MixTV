import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dumpEdgeOneKvHash,
  FakeEdgeOneKvBinding,
  seedEdgeOneKvHash,
} from "../../../../tests/helpers/fake-edgeone-kv";
import {
  formatDurationMs,
  getTrafficOverview,
  getTrafficSnapshot,
  recordApiRequest,
  recordPageVisit,
  recordThirdPartyRequest,
  resetStatsStoreForTest,
} from "./stats-service";

class FailingEdgeOneKvBinding extends FakeEdgeOneKvBinding {
  async get() {
    throw new Error("KV binding is unavailable.");
  }
}

let cacheStore: FakeEdgeOneKvBinding;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-16T10:20:30.000Z"));
  cacheStore = new FakeEdgeOneKvBinding();
  (globalThis as { cache?: FakeEdgeOneKvBinding }).cache = cacheStore;
  resetStatsStoreForTest();
});

afterEach(() => {
  delete (globalThis as { cache?: FakeEdgeOneKvBinding }).cache;
  resetStatsStoreForTest();
  vi.useRealTimers();
});

describe("stats-service", () => {
  it("records page visits in the current minute bucket", async () => {
    await recordPageVisit();

    await expect(dumpEdgeOneKvHash(cacheStore, "day:2026-05-16", { namespace: "stats" })).resolves.toMatchObject({
      "page:10:20:count": "1",
    });
  });

  it("records api and third-party request durations", async () => {
    await recordApiRequest({ durationMs: 123, ok: true });
    await recordThirdPartyRequest({ durationMs: 456, ok: false });

    await expect(dumpEdgeOneKvHash(cacheStore, "day:2026-05-16", { namespace: "stats" })).resolves.toMatchObject({
      "api:10:20:count": "1",
      "api:10:20:duration": "123",
      "api:10:20:success": "1",
      "third-party:10:20:count": "1",
      "third-party:10:20:duration": "456",
      "third-party:10:20:fail": "1",
    });
  });

  it("reads the current minute snapshot from KV hash data", async () => {
    await seedEdgeOneKvHash(cacheStore, "day:2026-05-16", {
      "page:10:20:count": "2",
      "page:10:20:duration": "4500",
      "page:10:20:success": "0",
      "page:10:20:fail": "0",
      "api:10:20:count": "3",
      "api:10:20:duration": "900",
      "api:10:20:success": "2",
      "api:10:20:fail": "1",
      "third-party:10:20:count": "4",
      "third-party:10:20:duration": "2600",
      "third-party:10:20:success": "3",
      "third-party:10:20:fail": "1",
    }, { namespace: "stats" });

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
    (globalThis as { cache?: FailingEdgeOneKvBinding }).cache = new FailingEdgeOneKvBinding();
    resetStatsStoreForTest();

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
