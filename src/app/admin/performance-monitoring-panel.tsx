"use client";

import {
  CloudDownloadOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  ProfileOutlined,
  RedoOutlined,
  SwapOutlined,
  DesktopOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, App, Button, Card, Divider, Tag } from "antd";

type Metric = {
  key: string;
  icon: string;
  title: string;
  value: string;
  detail: string;
  detailAccent?: string;
  tone: string;
};

const metricIconMap: Record<string, typeof DashboardOutlined> = {
  activity: LineChartOutlined,
  "arrow-left-right": SwapOutlined,
  "cloud-arrow-down": CloudDownloadOutlined,
  cpu: DashboardOutlined,
  memory: ProfileOutlined,
  "pc-display-horizontal": DesktopOutlined,
};

type PerformanceMetricsResponse = {
  checkedAt: string;
  metrics: Metric[];
};

async function readPerformanceMetrics(): Promise<PerformanceMetricsResponse> {
  const response = await fetch("/api/admin/performance");
  const payload =
    (await response.json()) as Partial<PerformanceMetricsResponse> & {
      message?: string;
    };

  if (!response.ok) {
    throw new Error(payload.message ?? "性能指标加载失败");
  }

  if (
    !Array.isArray(payload.metrics) ||
    typeof payload.checkedAt !== "string"
  ) {
    throw new Error("性能指标响应格式无效");
  }

  return {
    checkedAt: payload.checkedAt,
    metrics: payload.metrics,
  };
}

function formatCheckedAt(checkedAt: string) {
  const date = new Date(checkedAt);

  if (Number.isNaN(date.getTime())) {
    return "最后刷新时间未知";
  }

  return `最后刷新 ${date.toLocaleTimeString("zh-CN", { hour12: false })}`;
}

export function PerformanceMonitoringPanel() {
  const { message: msg } = App.useApp();
  const hasLoadedRef = useRef(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [lastRefresh, setLastRefresh] = useState("正在加载");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await readPerformanceMetrics();

      setMetrics(payload.metrics);
      setLastRefresh(formatCheckedAt(payload.checkedAt));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "性能指标加载失败";

      setErrorMessage(message);
      msg.error?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [msg]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <Card>
      <div className="flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <DashboardOutlined className="text-2xl text-accent" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  性能监控
                </h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              汇总应用进程、系统资源、数据库查询、请求吞吐和 API
              流量的实时运行指标。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Tag color="processing">{lastRefresh}</Tag>
            <Tag
              color={
                errorMessage ? "red" : metrics.length > 0 ? "green" : "gold"
              }
            >
              {errorMessage
                ? "加载异常"
                : metrics.length > 0
                  ? "指标已加载"
                  : "等待指标"}
            </Tag>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Alert
          title="性能数据用于判断运行状态"
          description="指标来自管理端性能接口，刷新失败时会保留上一次成功加载的数据，便于继续排查。"
          showIcon
          type={errorMessage ? "error" : "info"}
        />

        <section className="grid gap-4 mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <LineChartOutlined className="text-xl text-accent" />
              <p className="mb-0! text-base font-semibold text-foreground">
                核心资源与吞吐监控
              </p>
              <span className="rounded-md bg-default-100 px-2 py-0.5 text-xs font-medium text-default-500">
                {metrics.length > 0
                  ? `已加载 ${metrics.length} 项指标`
                  : "等待指标返回"}
              </span>
            </div>
            <Button
              disabled={isLoading}
              icon={<RedoOutlined />}
              size="small"
              onClick={loadMetrics}
            >
              {isLoading ? "刷新中" : "刷新"}
            </Button>
          </div>

          {errorMessage ? (
            <Alert
              title="性能指标加载失败"
              description={errorMessage}
              type="error"
              showIcon
            />
          ) : null}

          {isLoading && metrics.length === 0 ? (
            <div className="grid overflow-hidden rounded-lg border border-default-200 bg-surface md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="grid gap-3 border-b border-default-200 p-4 md:border-r md:nth-[2n]:border-r-0 xl:nth-[2n]:border-r xl:nth-[3n]:border-r-0 nth-last-[-n+1]:border-b-0 md:nth-last-[-n+2]:border-b-0 xl:nth-last-[-n+3]:border-b-0"
                >
                  <div className="h-4 w-24 rounded bg-default-200/80" />
                  <div className="h-7 w-20 rounded bg-default-200/80" />
                  <div className="h-3 w-36 rounded bg-default-200/80" />
                </div>
              ))}
            </div>
          ) : null}

          {metrics.length > 0 ? (
            <div className="grid overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface md:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => {
                const Icon = metricIconMap[metric.icon] ?? DashboardOutlined;

                return (
                  <div
                    key={metric.key}
                    className="grid gap-4 border-b border-(--ant-color-border) p-4 md:border-r md:nth-[2n]:border-r-0 xl:nth-[2n]:border-r xl:nth-[3n]:border-r-0 nth-last-[-n+1]:border-b-0 md:nth-last-[-n+2]:border-b-0 xl:nth-last-[-n+3]:border-b-0"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <p className="mb-0! min-w-0 text-sm font-medium text-default-600">
                        {metric.title}
                      </p>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 ${metric.tone}`}
                      >
                        <Icon className="text-base" />
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <p className="mb-0! text-2xl font-semibold tracking-tight text-foreground">
                        {metric.value}
                      </p>
                      <p className="text-xs leading-5 text-default-500">
                        {metric.detail}
                        {metric.detailAccent ? (
                          <span className={`ml-1 font-semibold ${metric.tone}`}>
                            {metric.detailAccent}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <Divider className="my-0" />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <DatabaseOutlined className="text-xl text-accent" />
            <p className="mb-0! text-sm font-medium text-foreground">
              监控范围
            </p>
            <span className="text-sm text-default-500">
              当前面板覆盖运行资源、查询、请求和 API 流量状态
            </span>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                Icon: DashboardOutlined,
                label: "应用进程",
                value: "CPU / 内存",
              },
              { Icon: ProfileOutlined, label: "系统资源", value: "主机状态" },
              { Icon: SwapOutlined, label: "请求吞吐", value: "每分钟统计" },
              {
                Icon: CloudDownloadOutlined,
                label: "API 流量",
                value: "接口调用趋势",
              },
            ].map((item) => {
              const Icon = item.Icon;

              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 border-b border-(--ant-color-border) px-4 py-3 last:border-b-0 sm:nth-last-[-n+2]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-default-500">
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
}
