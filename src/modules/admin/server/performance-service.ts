import { now } from "./admin-modules-store";
import os from "node:os";
import { formatDurationMs, getTrafficSnapshot } from "@/modules/stats";

export interface PerformanceMetric {
  key: string;
  icon: string;
  title: string;
  value: string;
  detail: string;
  detailAccent?: string;
  tone: string;
}

const cpuSampleMs = 80;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPercent(value: number) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return `${boundedValue.toFixed(boundedValue >= 10 ? 0 : 1)}%`;
}

function getCpuModel() {
  const firstCpu = os.cpus().find((cpu) => cpu.model.trim().length > 0);

  return firstCpu?.model.trim() ?? "Unknown CPU";
}

async function sampleProcessCpuPercent(cpuCount: number) {
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime.bigint();

  await new Promise((resolve) => setTimeout(resolve, cpuSampleMs));

  const elapsedMicroseconds = Number(process.hrtime.bigint() - startTime) / 1_000;
  const usage = process.cpuUsage(startUsage);
  const usedMicroseconds = usage.user + usage.system;

  if (elapsedMicroseconds <= 0 || cpuCount <= 0) {
    return 0;
  }

  return (usedMicroseconds / (elapsedMicroseconds * cpuCount)) * 100;
}

export async function getPerformanceMetrics() {
  const checkedAt = now();
  const trafficSnapshot = await getTrafficSnapshot();
  const cpus = os.cpus();
  const cpuCount = cpus.length || os.availableParallelism?.() || 1;
  const cpuPercent = await sampleProcessCpuPercent(cpuCount);
  const memory = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = Math.max(0, totalMemory - freeMemory);
  const systemMemoryPercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;
  const metrics: PerformanceMetric[] = [
    {
      key: "process-cpu",
      icon: "cpu",
      title: "进程 CPU",
      value: formatPercent(cpuPercent),
      detail: `${cpuCount} 核 · ${getCpuModel()}`,
      tone: "text-accent",
    },
    {
      key: "process-memory",
      icon: "memory",
      title: "进程内存",
      value: formatBytes(memory.rss),
      detail: `RSS: ${formatBytes(memory.rss)}`,
      detailAccent: `堆内存: ${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}`,
      tone: "text-accent",
    },
    {
      key: "system-memory",
      icon: "pc-display-horizontal",
      title: "系统内存",
      value: formatBytes(usedMemory),
      detail: `总共 ${formatBytes(totalMemory)} · 可用 ${formatBytes(freeMemory)}`,
      detailAccent: `(${formatPercent(systemMemoryPercent)})`,
      tone: systemMemoryPercent >= 85 ? "text-danger" : systemMemoryPercent >= 70 ? "text-warning" : "text-accent",
    },
    {
      key: "page-traffic",
      icon: "arrow-left-right",
      title: "页面访问/分钟",
      value: `${trafficSnapshot.page.count.toFixed(0)} 次`,
      detail: `平均停留 ${formatDurationMs(trafficSnapshot.page.averageDurationMs)}`,
      detailAccent: `累计 ${formatDurationMs(trafficSnapshot.page.totalDurationMs)}`,
      tone: trafficSnapshot.page.count > 0 ? "text-accent" : "text-default-500",
    },
    {
      key: "api-traffic",
      icon: "activity",
      title: "API 流量/分钟",
      value: `${trafficSnapshot.api.count.toFixed(0)} 次`,
      detail: `成功 ${trafficSnapshot.api.successCount.toFixed(0)} · 失败 ${trafficSnapshot.api.failCount.toFixed(0)}`,
      detailAccent: `平均 ${formatDurationMs(trafficSnapshot.api.averageDurationMs)}`,
      tone: trafficSnapshot.api.failCount > 0 ? "text-warning" : "text-accent",
    },
    {
      key: "third-party-traffic",
      icon: "cloud-arrow-down",
      title: "第三方请求/分钟",
      value: `${trafficSnapshot.thirdParty.count.toFixed(0)} 次`,
      detail: `成功 ${trafficSnapshot.thirdParty.successCount.toFixed(0)} · 失败 ${trafficSnapshot.thirdParty.failCount.toFixed(0)}`,
      detailAccent: `平均 ${formatDurationMs(trafficSnapshot.thirdParty.averageDurationMs)}`,
      tone: trafficSnapshot.thirdParty.failCount > 0 ? "text-warning" : "text-accent",
    },
  ];

  return { checkedAt, metrics };
}
