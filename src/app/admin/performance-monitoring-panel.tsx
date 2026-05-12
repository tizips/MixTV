"use client";

import { useState } from "react";
import { Button, Card, Chip } from "@heroui/react";

type Metric = {
  key: string;
  icon: string;
  title: string;
  value: string;
  detail: string;
  detailAccent?: string;
  tone: string;
};

const metrics: Metric[] = [
  {
    key: "process-cpu",
    icon: "bi-cpu",
    title: "进程 CPU",
    value: "18%",
    detail: "2 核 · Intel(R) Xeon(R) Platinum 82",
    tone: "text-lime-500",
  },
  {
    key: "process-memory",
    icon: "bi-memory",
    title: "进程内存",
    value: "412 MB",
    detail: "堆内存: 52.55 MB",
    detailAccent: "/ 68.05 MB",
    tone: "text-sky-500",
  },
  {
    key: "system-memory",
    icon: "bi-pc-display-horizontal",
    title: "系统内存",
    value: "867.42 MB",
    detail: "总共 1.95 GB",
    detailAccent: "(43.5%)",
    tone: "text-indigo-500",
  },
  {
    key: "db-query",
    icon: "bi-database",
    title: "DB 查询/分钟",
    value: "1,248",
    detail: "平均: 5.2 次/请求",
    detailAccent: "(良好)",
    tone: "text-emerald-500",
  },
  {
    key: "request",
    icon: "bi-arrow-left-right",
    title: "请求/分钟",
    value: "3,906",
    detail: "平均响应: 417ms",
    detailAccent: "(可接受)",
    tone: "text-amber-500",
  },
  {
    key: "api-traffic",
    icon: "bi-activity",
    title: "API 流量/分钟",
    value: "86 MB",
    detail: "最近 1 分钟出入站流量",
    detailAccent: "(非常轻量)",
    tone: "text-fuchsia-500",
  },
];

export function PerformanceMonitoringPanel() {
  const [lastRefresh, setLastRefresh] = useState("刚刚刷新");

  const refreshMetrics = () => {
    setLastRefresh(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  };

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-speedometer2 text-2xl text-lime-300" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">性能监控</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              汇总应用进程、系统资源、数据库查询、请求吞吐和 API 流量的实时运行指标。
            </p>
          </div>

          <Chip color="accent" variant="soft">
            {lastRefresh}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 md:p-8 md:pt-5">
        <section className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-default-500">性能指标</p>
              <p className="text-base font-semibold text-foreground">核心资源与吞吐监控</p>
            </div>
            <Button size="sm" variant="outline" onPress={refreshMetrics}>
              <i aria-hidden="true" className="bi bi-arrow-clockwise" />
              刷新
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <Card key={metric.key} className="border border-default-200/80 bg-background/60" variant="secondary">
                <Card.Header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-2 pt-4">
                  <p className="min-w-0 text-base font-bold text-foreground">{metric.title}</p>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-default-200 bg-background ${metric.tone}`}
                  >
                    <i aria-hidden="true" className={`bi ${metric.icon} text-base`} />
                  </span>
                </Card.Header>
                <Card.Content className="px-4 pb-4 pt-0">
                  <div className="grid gap-1">
                    <p className="text-xl font-semibold text-foreground">{metric.value}</p>
                    <p className="text-xs leading-5 text-default-500">
                      {metric.detail}
                      {metric.detailAccent ? <span className={`ml-1 font-medium ${metric.tone}`}>{metric.detailAccent}</span> : null}
                    </p>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </section>
      </Card.Content>
    </Card>
  );
}
