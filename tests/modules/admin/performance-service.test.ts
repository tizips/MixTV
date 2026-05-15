import { describe, expect, it } from "vitest";
import { getPerformanceMetrics } from "@/modules/admin/server/performance-service";

describe("performance service", () => {
  it("returns real runtime resource metrics and marks unadapted counters", async () => {
    const result = await getPerformanceMetrics();

    expect(result.checkedAt).toEqual(expect.any(String));
    expect(new Date(result.checkedAt).toString()).not.toBe("Invalid Date");

    const metricsByKey = new Map(result.metrics.map((metric) => [metric.key, metric]));

    expect(metricsByKey.get("process-cpu")).toMatchObject({
      detail: expect.stringContaining("核"),
      title: "进程 CPU",
    });
    expect(metricsByKey.get("process-cpu")?.value).toMatch(/^\d+(\.\d)?%$/);

    expect(metricsByKey.get("process-memory")).toMatchObject({
      detail: expect.stringContaining("RSS"),
      title: "进程内存",
    });
    expect(metricsByKey.get("process-memory")?.detailAccent).toContain("堆内存");

    expect(metricsByKey.get("system-memory")).toMatchObject({
      detail: expect.stringContaining("总共"),
      title: "系统内存",
    });
    expect(metricsByKey.get("system-memory")?.detailAccent).toMatch(/^\(\d+(\.\d)?%\)$/);

    expect(metricsByKey.get("db-query")).toMatchObject({
      detail: "数据库查询计数暂未接入",
      value: "未接入",
    });
    expect(metricsByKey.get("request")).toMatchObject({
      detail: "请求吞吐统计暂未接入",
      value: "未接入",
    });
    expect(metricsByKey.get("api-traffic")).toMatchObject({
      detail: "API 出入站流量统计暂未接入",
      value: "未接入",
    });
  });
});
