"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Chip } from "@heroui/react";

type Metric = {
  key: string;
  icon: string;
  title: string;
  value: string;
  detail: string;
  detailAccent?: string;
  tone: string;
};

type PerformanceMetricsResponse = {
  checkedAt: string;
  metrics: Metric[];
};

async function readPerformanceMetrics(): Promise<PerformanceMetricsResponse> {
  const response = await fetch("/api/admin/performance");
  const payload = (await response.json()) as Partial<PerformanceMetricsResponse> & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? "性能指标加载失败");
  }

  if (!Array.isArray(payload.metrics) || typeof payload.checkedAt !== "string") {
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
      setErrorMessage(error instanceof Error ? error.message : "性能指标加载失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <Card>
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-speedometer2 text-2xl text-accent" />
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
            <Button isDisabled={isLoading} size="sm" variant="outline" onPress={loadMetrics}>
              <i aria-hidden="true" className="bi bi-arrow-clockwise" />
              {isLoading ? "刷新中" : "刷新"}
            </Button>
          </div>

          {errorMessage ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>性能指标加载失败</Alert.Title>
                <Alert.Description>{errorMessage}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          {isLoading && metrics.length === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Card key={index} className="border border-default-200/80">
                  <Card.Content className="grid gap-3 px-4 py-4">
                    <div className="h-4 w-24 rounded bg-default-200" />
                    <div className="h-7 w-20 rounded bg-default-200" />
                    <div className="h-3 w-36 rounded bg-default-200" />
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : null}

          {metrics.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => (
                <Card key={metric.key} className="border border-default-200/80">
                  <Card.Header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-2 pt-4">
                    <p className="min-w-0 text-base font-bold text-foreground">{metric.title}</p>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}
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
          ) : null}
        </section>
      </Card.Content>
    </Card>
  );
}
