"use client";

import {
  AppstoreOutlined,
  BarChartOutlined,
  CloudDownloadOutlined,
  RedoOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Divider, Tag } from "antd";
import type { TrafficDaySummary, TrafficMinuteMetric, TrafficOverview, TrafficTimelinePoint } from "../server/stats-service";

type StatsDashboardProps = {
  overview: TrafficOverview;
};

const numberFormatter = new Intl.NumberFormat("zh-CN");

function formatCount(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, value)).toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "更新时间未知";
  }

  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
  });
}

function formatDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return date.toLocaleDateString("zh-CN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function createEmptyTimelineMetric(): TrafficMinuteMetric {
  return {
    averageDurationMs: 0,
    count: 0,
    failCount: 0,
    successCount: 0,
    totalDurationMs: 0,
  };
}

function addMetric(target: TrafficMinuteMetric, source: TrafficMinuteMetric) {
  target.count += source.count;
  target.totalDurationMs += source.totalDurationMs;
  target.successCount += source.successCount;
  target.failCount += source.failCount;
  target.averageDurationMs = target.count > 0 ? Math.round(target.totalDurationMs / target.count) : 0;
}

function formatHourLabel(dayKey: string, minuteKey: string) {
  const date = new Date(`${dayKey}T${minuteKey}:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return minuteKey;
  }

  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function aggregateHourlyTimeline(points: TrafficTimelinePoint[]) {
  const buckets = new Map<
    string,
    {
      api: TrafficMinuteMetric;
      dayKey: string;
      label: string;
      minuteKey: string;
      page: TrafficMinuteMetric;
      thirdParty: TrafficMinuteMetric;
    }
  >();

  for (const point of points) {
    const hourKey = `${point.dayKey} ${point.minuteKey.slice(0, 2)}`;
    const existing = buckets.get(hourKey);

    if (existing) {
      addMetric(existing.page, point.page);
      addMetric(existing.api, point.api);
      addMetric(existing.thirdParty, point.thirdParty);
      continue;
    }

    buckets.set(hourKey, {
      api: {
        ...createEmptyTimelineMetric(),
        averageDurationMs: point.api.averageDurationMs,
        count: point.api.count,
        failCount: point.api.failCount,
        successCount: point.api.successCount,
        totalDurationMs: point.api.totalDurationMs,
      },
      dayKey: point.dayKey,
      label: formatHourLabel(point.dayKey, point.minuteKey),
      minuteKey: `${point.minuteKey.slice(0, 2)}:00`,
      page: {
        ...createEmptyTimelineMetric(),
        averageDurationMs: point.page.averageDurationMs,
        count: point.page.count,
        failCount: point.page.failCount,
        successCount: point.page.successCount,
        totalDurationMs: point.page.totalDurationMs,
      },
      thirdParty: {
        ...createEmptyTimelineMetric(),
        averageDurationMs: point.thirdParty.averageDurationMs,
        count: point.thirdParty.count,
        failCount: point.thirdParty.failCount,
        successCount: point.thirdParty.successCount,
        totalDurationMs: point.thirdParty.totalDurationMs,
      },
    });
  }

  return Array.from(buckets.values()).map((point) => {
    point.page.averageDurationMs = point.page.count > 0 ? Math.round(point.page.totalDurationMs / point.page.count) : 0;
    point.api.averageDurationMs = point.api.count > 0 ? Math.round(point.api.totalDurationMs / point.api.count) : 0;
    point.thirdParty.averageDurationMs =
      point.thirdParty.count > 0 ? Math.round(point.thirdParty.totalDurationMs / point.thirdParty.count) : 0;

    return point;
  });
}

type TrafficTotals = {
  all: TrafficMinuteMetric;
  api: TrafficMinuteMetric;
  page: TrafficMinuteMetric;
  thirdParty: TrafficMinuteMetric;
};

function totalMetric(days: TrafficDaySummary[]): TrafficTotals {
  return days.reduce<TrafficTotals>(
    (accumulator, day) => {
      accumulator.page.count += day.page.count;
      accumulator.page.totalDurationMs += day.page.totalDurationMs;
      accumulator.page.successCount += day.page.successCount;
      accumulator.page.failCount += day.page.failCount;
      accumulator.page.averageDurationMs =
        accumulator.page.count > 0 ? Math.round(accumulator.page.totalDurationMs / accumulator.page.count) : 0;

      accumulator.api.count += day.api.count;
      accumulator.api.totalDurationMs += day.api.totalDurationMs;
      accumulator.api.successCount += day.api.successCount;
      accumulator.api.failCount += day.api.failCount;
      accumulator.api.averageDurationMs =
        accumulator.api.count > 0 ? Math.round(accumulator.api.totalDurationMs / accumulator.api.count) : 0;

      accumulator.thirdParty.count += day.thirdParty.count;
      accumulator.thirdParty.totalDurationMs += day.thirdParty.totalDurationMs;
      accumulator.thirdParty.successCount += day.thirdParty.successCount;
      accumulator.thirdParty.failCount += day.thirdParty.failCount;
      accumulator.thirdParty.averageDurationMs =
        accumulator.thirdParty.count > 0 ? Math.round(accumulator.thirdParty.totalDurationMs / accumulator.thirdParty.count) : 0;

      accumulator.all.count += day.page.count + day.api.count + day.thirdParty.count;
      accumulator.all.totalDurationMs += day.page.totalDurationMs + day.api.totalDurationMs + day.thirdParty.totalDurationMs;
      accumulator.all.successCount += day.page.successCount + day.api.successCount + day.thirdParty.successCount;
      accumulator.all.failCount += day.page.failCount + day.api.failCount + day.thirdParty.failCount;
      accumulator.all.averageDurationMs =
        accumulator.all.count > 0 ? Math.round(accumulator.all.totalDurationMs / accumulator.all.count) : 0;
      return accumulator;
    },
    {
      all: { averageDurationMs: 0, count: 0, failCount: 0, successCount: 0, totalDurationMs: 0 },
      api: { averageDurationMs: 0, count: 0, failCount: 0, successCount: 0, totalDurationMs: 0 },
      page: { averageDurationMs: 0, count: 0, failCount: 0, successCount: 0, totalDurationMs: 0 },
      thirdParty: { averageDurationMs: 0, count: 0, failCount: 0, successCount: 0, totalDurationMs: 0 },
    },
  );
}

function MetricCard({
  Icon,
  accent,
  description,
  title,
  value,
}: {
  accent: string;
  description: string;
  Icon: typeof BarChartOutlined;
  title: string;
  value: string;
}) {
  return (
    <Card
      style={{
        background: "color-mix(in oklab, var(--background) 80%, transparent)",
        border: "1px solid color-mix(in oklab, var(--foreground) 8%, transparent)",
        boxShadow: "0 18px 60px color-mix(in oklab, var(--foreground) 8%, transparent)",
      }}
      styles={{ body: { padding: 20 } }}
      title={
        <div className="grid grid-cols-[2.8rem_minmax(0,1fr)] items-start gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent} bg-current/10`}>
            <Icon className="text-lg" />
          </span>
          <div className="grid min-w-0 gap-1">
            <p className="text-sm font-medium text-default-500">{title}</p>
            <p className="text-xs leading-5 text-default-500">{description}</p>
          </div>
        </div>
      }
      extra={<Tag color="processing">KPI</Tag>}
    >
      <div className="flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      </div>
    </Card>
  );
}

function MinuteSummary({
  label,
  metric,
  tone,
}: {
  label: string;
  metric: TrafficMinuteMetric;
  tone: string;
}) {
  const successRate = metric.count > 0 ? (metric.successCount / Math.max(1, metric.successCount + metric.failCount)) * 100 : 0;

  return (
    <div className="rounded-2xl border border-default-200/80 bg-background/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-default-500">{label}</p>
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{formatCount(metric.count)} 次</p>
      <p className="mt-1 text-xs leading-5 text-default-500">
        成功率 {formatPercent(successRate)} · 平均 {metric.averageDurationMs > 0 ? `${Math.round(metric.averageDurationMs)}ms` : "0ms"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Tag color="processing">成功 {formatCount(metric.successCount)}</Tag>
        <Tag color="error">失败 {formatCount(metric.failCount)}</Tag>
      </div>
    </div>
  );
}

function TimelineChart({ points }: { points: TrafficTimelinePoint[] }) {
  const peak = Math.max(
    1,
    ...points.map((point) => point.page.count + point.api.count + point.thirdParty.count),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="flex items-end gap-2">
          {points.map((point, index) => {
            const pageCount = point.page.count;
            const apiCount = point.api.count;
            const thirdPartyCount = point.thirdParty.count;
            const totalCount = pageCount + apiCount + thirdPartyCount;
            const barHeight = Math.max(4, Math.round((totalCount / peak) * 144));
            const pageHeight = totalCount > 0 ? Math.max(2, Math.round((pageCount / totalCount) * barHeight)) : 0;
            const apiHeight = totalCount > 0 ? Math.max(2, Math.round((apiCount / totalCount) * barHeight)) : 0;
            const thirdPartyHeight = Math.max(0, barHeight - pageHeight - apiHeight);
            const showLabel = points.length <= 12 || index % 2 === 0 || index === points.length - 1;

            return (
              <div key={`${point.dayKey}-${point.minuteKey}`} className="flex w-[38px] flex-col items-center gap-2">
                <div className="flex h-36 w-full flex-col justify-end overflow-hidden rounded-full bg-default-100/80">
                  {thirdPartyHeight > 0 ? (
                    <div className="w-full rounded-t-full bg-amber-500/85" style={{ height: `${thirdPartyHeight}px` }} />
                  ) : null}
                  {apiHeight > 0 ? <div className="w-full bg-cyan-500/85" style={{ height: `${apiHeight}px` }} /> : null}
                  {pageHeight > 0 ? (
                    <div className="w-full rounded-b-full bg-accent/90" style={{ height: `${pageHeight}px` }} />
                  ) : null}
                </div>
                <p className="h-8 text-[10px] leading-4 text-default-400">{showLabel ? point.label : ""}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StatsDashboard({ overview }: StatsDashboardProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const totals = totalMetric(overview.dailySummaries);
  const dailySummaries = [...overview.dailySummaries].reverse();
  const currentMinute = overview.currentMinute;
  const hourlyTimeline = aggregateHourlyTimeline(overview.timeline);
  const apiShare =
    totals.all.count > 0 ? (totals.all.successCount / Math.max(1, totals.all.successCount + totals.all.failCount)) * 100 : 0;

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--accent)_20%,transparent)_0%,transparent_28%),radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--foreground)_6%,transparent)_0%,transparent_26%),linear-gradient(180deg,color-mix(in_oklab,var(--surface)_92%,white)_0%,color-mix(in_oklab,var(--surface)_96%,black)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--accent)_10%,transparent)_50%,transparent_100%)] opacity-70"
      />

      <section className="relative mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <header className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <Card
            style={{
              background: "color-mix(in oklab, var(--background) 75%, transparent)",
              border: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
              boxShadow: "0 24px 80px color-mix(in oklab, var(--foreground) 10%, transparent)",
            }}
            styles={{ body: { padding: 0 } }}
          >
            <div className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <BarChartOutlined className="text-2xl text-accent" />
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.28em] text-default-500">最近 7 天总览</p>
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">运营口径</h1>
                    </div>
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                    统计页面访问、API 流量和第三方资源站请求，保留最近 7 天，按分钟聚合。页面与接口耗时会一起呈现，方便快速判断流量高峰和失败波动。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Tag color="processing">{formatTimestamp(overview.checkedAt)}</Tag>
                  <Button disabled={isRefreshing} size="small" onClick={refresh}>
                    {isRefreshing ? <SyncOutlined spin /> : <RedoOutlined />}
                    {isRefreshing ? "刷新中" : "刷新"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 pt-5 md:p-8 md:pt-5">
              <div className="grid gap-3 md:grid-cols-3">
                <MinuteSummary label="当前页面分钟" metric={currentMinute.page} tone="bg-accent" />
                <MinuteSummary label="当前 API 分钟" metric={currentMinute.api} tone="bg-cyan-500" />
                <MinuteSummary label="当前第三方分钟" metric={currentMinute.thirdParty} tone="bg-amber-500" />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-default-500">
                <Tag color="processing">页面</Tag>
                <span>停留时长</span>
                <span className="text-default-300">·</span>
                <Tag>API</Tag>
                <span>请求耗时</span>
                <span className="text-default-300">·</span>
                <Tag color="warning">第三方</Tag>
                <span>请求耗时</span>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card
              style={{
                background: "color-mix(in oklab, var(--background) 75%, transparent)",
                border: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
              }}
            >
              <div className="px-5 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-default-500">最近 7 天</p>
                    <p className="text-base font-semibold text-foreground">总请求次数</p>
                  </div>
                  <Tag color="processing">{formatCount(totals.all.count)} 次</Tag>
                </div>
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <div className="grid gap-3 px-5 pb-5 text-center">
                <div className="relative min-h-[8rem] w-full overflow-hidden rounded-2xl bg-accent/10 px-6 py-4">
                  <p className="absolute left-6 top-4 text-xs font-medium uppercase tracking-[0.24em] text-default-500">总请求</p>
                  <div className="flex min-h-[8rem] w-full items-center justify-center">
                    <p className="text-4xl font-semibold tracking-tight text-foreground">
                      {formatCount(totals.all.count)} 次
                    </p>
                  </div>
                </div>
                <p className="text-sm text-default-600">
                  平均 {totals.all.averageDurationMs > 0 ? `${Math.round(totals.all.averageDurationMs)}ms` : "0ms"} · 成功率 {formatPercent(apiShare)}
                </p>
                <p className="text-xs text-default-500">近 7 天 · 分钟级</p>
              </div>
            </Card>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MetricCard
            accent="text-accent"
            description="最近 7 天内页面访问总量"
            Icon={AppstoreOutlined}
            title="页面访问"
            value={formatCount(totals.page.count)}
          />
          <MetricCard
            accent="text-cyan-500"
            description="最近 7 天内 API 请求总量"
            Icon={ThunderboltOutlined}
            title="API 请求"
            value={formatCount(totals.api.count)}
          />
          <MetricCard
            accent="text-amber-500"
            description="最近 7 天内第三方资源站请求总量"
            Icon={CloudDownloadOutlined}
            title="第三方请求"
            value={formatCount(totals.thirdParty.count)}
          />
        </section>

        <section className="mt-8 grid gap-6">
          <Card
            style={{
              background: "color-mix(in oklab, var(--background) 75%, transparent)",
              border: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
            }}
          >
            <div className="flex flex-col gap-3 px-5 pb-2 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-default-500">每小时</p>
                  <p className="text-base font-semibold text-foreground">最近 12 小时访问波形</p>
                </div>
                <Tag color="processing">12 小时窗口</Tag>
              </div>
              <p className="text-sm leading-6 text-default-500">这里展示每小时的总请求量，颜色区分页面、API 和第三方请求。</p>
            </div>
            <Divider style={{ margin: "12px 0" }} />
            <div className="grid gap-4 px-5 py-5">
              <TimelineChart points={hourlyTimeline} />
              <div className="flex flex-wrap items-center gap-3 text-xs text-default-500">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  页面
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                  API
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  第三方
                </span>
              </div>
            </div>
          </Card>
        </section>

        <Card
          className="mt-8"
          style={{
            background: "color-mix(in oklab, var(--background) 75%, transparent)",
            border: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
          }}
        >
          <div className="px-5 pb-2 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-default-500">7 天明细</p>
                <p className="text-base font-semibold text-foreground">按天汇总表</p>
              </div>
              <Tag color="processing">{formatTimestamp(overview.checkedAt)}</Tag>
            </div>
          </div>
          <Divider style={{ margin: "12px 0" }} />
          <div className="overflow-x-auto px-5 py-4">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.24em] text-default-400">
                  <th className="border-b border-default-200 px-3 py-3 font-medium">日期</th>
                  <th className="border-b border-default-200 px-3 py-3 font-medium">页面</th>
                  <th className="border-b border-default-200 px-3 py-3 font-medium">API</th>
                  <th className="border-b border-default-200 px-3 py-3 font-medium">第三方</th>
                  <th className="border-b border-default-200 px-3 py-3 font-medium">成功率</th>
                  <th className="border-b border-default-200 px-3 py-3 font-medium">平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {dailySummaries.map((day) => {
                  const dayTotal = day.page.count + day.api.count + day.thirdParty.count;
                  const daySuccess = day.page.successCount + day.api.successCount + day.thirdParty.successCount;
                  const dayFail = day.page.failCount + day.api.failCount + day.thirdParty.failCount;
                  const successRate = dayTotal > 0 ? (daySuccess / Math.max(1, daySuccess + dayFail)) * 100 : 0;
                  const averageDuration = dayTotal > 0
                    ? Math.round((day.page.totalDurationMs + day.api.totalDurationMs + day.thirdParty.totalDurationMs) / dayTotal)
                    : 0;

                  return (
                    <tr key={day.dayKey} className="align-top" data-day-key={day.dayKey}>
                      <td className="border-b border-default-100 px-3 py-3 font-medium text-foreground">{formatDayLabel(day.dayKey)}</td>
                      <td className="border-b border-default-100 px-3 py-3 text-default-600">{formatCount(day.page.count)} 次</td>
                      <td className="border-b border-default-100 px-3 py-3 text-default-600">{formatCount(day.api.count)} 次</td>
                      <td className="border-b border-default-100 px-3 py-3 text-default-600">{formatCount(day.thirdParty.count)} 次</td>
                      <td className="border-b border-default-100 px-3 py-3 text-default-600">{formatPercent(successRate)}</td>
                      <td className="border-b border-default-100 px-3 py-3 text-default-600">{averageDuration > 0 ? `${averageDuration}ms` : "0ms"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
