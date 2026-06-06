import { describe, expect, it } from "vitest";
import { getPerformanceMetrics } from "@/modules/admin/server/performance-service";

describe("performance service", () => {
  it("returns real runtime resource metrics and marks unadapted counters", async () => {
    const result = await getPerformanceMetrics();

    expect(result.checkedAt).toEqual(expect.any(String));
    expect(new Date(result.checkedAt).toString()).not.toBe("Invalid Date");

    const metricsByKey = new Map(result.metrics.map((metric) => [metric.key, metric]));

    expect(metricsByKey.get("system-cpu")).toMatchObject({
      detail: expect.stringContaining("核"),
      title: "系统 CPU",
    });
    expect(metricsByKey.get("system-cpu")?.value).toContain("核");

    expect(metricsByKey.get("system-memory")).toMatchObject({
      detail: expect.stringContaining("总共"),
      title: "系统内存",
    });
    expect(metricsByKey.get("system-memory")?.detailAccent).toMatch(/^\(\d+(\.\d)?%\)$/);

    expect(metricsByKey.get("page-traffic")).toMatchObject({
      detail: expect.stringContaining("平均停留"),
      title: "页面访问/分钟",
    });
    expect(metricsByKey.get("api-traffic")).toMatchObject({
      detail: expect.stringContaining("成功"),
      title: "API 流量/分钟",
    });
    expect(metricsByKey.get("third-party-traffic")).toMatchObject({
      detail: expect.stringContaining("成功"),
      title: "第三方请求/分钟",
    });
  });
});
