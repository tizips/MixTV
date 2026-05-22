import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatsDashboard } from "./stats-dashboard";
import type { TrafficOverview } from "../server/stats-service";

const routerState = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerState,
}));

function createMetric(count: number) {
  return {
    averageDurationMs: count,
    count,
    failCount: 0,
    successCount: count,
    totalDurationMs: count * 10,
  };
}

function createOverview(): TrafficOverview {
  const timeline = Array.from({ length: 720 }, (_, index) => {
    const hour = String(Math.floor(index / 60)).padStart(2, "0");
    const minute = String(index % 60).padStart(2, "0");

    return {
      api: createMetric(2),
      dayKey: "2026-05-17",
      label: `${hour}:${minute}`,
      minuteKey: `${hour}:${minute}`,
      page: createMetric(3),
      thirdParty: createMetric(1),
    };
  });

  return {
    checkedAt: "2026-05-17T00:00:00.000Z",
    currentMinute: {
      api: createMetric(2),
      checkedAt: "2026-05-17T00:00:00.000Z",
      minuteKey: "2026-05-17 00:00",
      page: createMetric(3),
      thirdParty: createMetric(1),
    },
    dailySummaries: [
      {
        api: createMetric(90),
        dayKey: "2026-05-16",
        label: "05月16日",
        page: createMetric(150),
        thirdParty: createMetric(50),
      },
      {
        api: createMetric(120),
        dayKey: "2026-05-17",
        label: "05月17日",
        page: createMetric(180),
        thirdParty: createMetric(60),
      },
    ],
    timeline,
  };
}

describe("StatsDashboard", () => {
  it("renders the hourly timeline and removes the runbook card", () => {
    const html = renderToStaticMarkup(<StatsDashboard overview={createOverview()} />);

    expect(html).toContain("每小时");
    expect(html).toContain("最近 12 小时访问波形");
    expect(html).not.toContain("运行口径");
    expect(html).not.toContain("分钟级访问波形");
    expect(html).toContain("总请求次数");
    expect(html).toContain("近 7 天");
    expect(html.indexOf('data-day-key="2026-05-17"')).toBeLessThan(html.indexOf('data-day-key="2026-05-16"'));
  });
});
