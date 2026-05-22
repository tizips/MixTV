"use client";

import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseFilled,
  DeleteFilled,
  DeleteOutlined,
  FileTextOutlined,
  HddOutlined,
  PlaySquareFilled,
  RedoOutlined,
  StarFilled,
  TableOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Alert, Button, Card, Divider, Tag, theme } from "antd";

type CacheCategory = {
  key: string;
  Icon: typeof StarFilled;
  title: string;
  description: string;
  items: number;
  sizeKb: number;
};

const initialCacheCategories: CacheCategory[] = [
  {
    key: "douban",
    Icon: StarFilled,
    title: "豆瓣数据",
    description: "缓存豆瓣评分、简介、海报和演员信息。",
    items: 128,
    sizeKb: 18432,
  },
  {
    key: "danmaku",
    Icon: FileTextOutlined,
    title: "弹幕数据",
    description: "缓存弹幕源查询结果和视频弹幕索引。",
    items: 86,
    sizeKb: 9216,
  },
  {
    key: "tmdb",
    Icon: VideoCameraOutlined,
    title: "TMDB数据",
    description: "缓存 TMDB 剧集、电影、季集和图片元数据。",
    items: 214,
    sizeKb: 32768,
  },
  {
    key: "short-drama",
    Icon: PlaySquareFilled,
    title: "短剧数据",
    description: "缓存短剧列表、播放地址和详情聚合结果。",
    items: 62,
    sizeKb: 6144,
  },
];

function formatSize(sizeKb: number) {
  if (sizeKb >= 1024) {
    return `${(sizeKb / 1024).toFixed(sizeKb % 1024 === 0 ? 0 : 1)} MB`;
  }

  return `${sizeKb} KB`;
}

export function CacheManagementPanel() {
  const { token } = theme.useToken();
  const [cacheCategories, setCacheCategories] = useState(
    initialCacheCategories,
  );
  const [statusMessage, setStatusMessage] = useState("缓存统计已加载");

  const cacheStats = useMemo(() => {
    const totalItems = cacheCategories.reduce(
      (total, category) => total + category.items,
      0,
    );
    const totalSizeKb = cacheCategories.reduce(
      (total, category) => total + category.sizeKb,
      0,
    );
    const activeTypes = cacheCategories.filter(
      (category) => category.items > 0,
    ).length;

    return {
      totalItems,
      totalSizeKb,
      totalSize: formatSize(totalSizeKb),
      activeTypes,
    };
  }, [cacheCategories]);

  const totalCategoryCount = cacheCategories.length;
  const activePercent =
    totalCategoryCount > 0
      ? Math.round((cacheStats.activeTypes / totalCategoryCount) * 100)
      : 0;
  const emptyTypes = totalCategoryCount - cacheStats.activeTypes;
  const emptyPercent =
    totalCategoryCount > 0
      ? Math.round((emptyTypes / totalCategoryCount) * 100)
      : 0;
  const maxCategorySize = Math.max(
    1,
    ...cacheCategories.map((category) => category.sizeKb),
  );
  const statItems = [
    {
      helper: "全部缓存分类的记录数量",
      icon: <AppstoreOutlined />,
      label: "缓存项",
      suffix: "项",
      tone: "var(--accent)",
      value: cacheStats.totalItems,
      width: cacheStats.totalItems > 0 ? 100 : 0,
    },
    {
      helper: "当前缓存估算磁盘占用",
      icon: <HddOutlined />,
      label: "存储空间",
      suffix: "",
      tone: token.colorInfo,
      value: cacheStats.totalSize,
      width: cacheStats.totalSizeKb > 0 ? 100 : 0,
    },
    {
      helper: "仍有数据的缓存分类",
      icon: <TableOutlined />,
      label: "活跃类型",
      suffix: "类",
      tone: token.colorWarning,
      value: cacheStats.activeTypes,
      width: activePercent,
    },
  ];

  const refreshStats = () => {
    setStatusMessage("缓存统计已刷新");
  };

  const clearCategory = (categoryKey: string) => {
    setCacheCategories((current) =>
      current.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              items: 0,
              sizeKb: 0,
            }
          : category,
      ),
    );
    setStatusMessage("已清理所选缓存分类");
  };

  const clearAllCaches = () => {
    setCacheCategories((current) =>
      current.map((category) => ({
        ...category,
        items: 0,
        sizeKb: 0,
      })),
    );
    setStatusMessage("已清理所有缓存");
  };

  return (
    <Card>
      <div className="flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <DatabaseFilled className="text-2xl text-accent" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  缓存管理
                </h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              查看缓存数据统计，按分类清理站点聚合数据，或一次性释放全部缓存占用。
            </p>
          </div>

          <Tag color={cacheStats.activeTypes > 0 ? "success" : "warning"}>
            {cacheStats.activeTypes > 0
              ? `活跃缓存 ${cacheStats.activeTypes} 类`
              : "暂无缓存"}
          </Tag>
        </div>
      </div>

      <div
        className="mb-6 overflow-hidden rounded-lg border border-(--admin-stat-border) bg-(--surface)"
        aria-live="polite"
        style={
          {
            "--admin-stat-active": "var(--accent)",
            "--admin-stat-border": token.colorBorderSecondary,
            "--admin-stat-danger": token.colorError,
            "--admin-stat-split": token.colorSplit,
          } as CSSProperties
        }
      >
        <div className="flex flex-col gap-4 border-b border-(--admin-stat-split) px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <BarChartOutlined className="text-xl" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">缓存统计</p>
              <p className="mt-1 text-xs leading-5 text-default-500">
                当前缓存分类、记录数量和存储占用概览。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Tag color="processing">{statusMessage}</Tag>
            <Button size="small" onClick={refreshStats}>
              <RedoOutlined />
              刷新
            </Button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(15rem,0.95fr)_minmax(0,2fr)]">
          <div className="border-b border-(--admin-stat-split) p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-default-500">
                  Cache total
                </p>
                <p className="mt-2 text-4xl font-semibold text-foreground">
                  {totalCategoryCount}
                </p>
                <p className="mt-2 text-sm text-default-500">缓存分类总数</p>
              </div>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-accent"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 12%, transparent)",
                }}
              >
                <DatabaseFilled className="text-lg" />
              </span>
            </div>

            <div
              className="mt-5 flex h-2 overflow-hidden rounded-full bg-(--surface-secondary)"
              aria-label={`活跃缓存 ${activePercent}%，空缓存 ${emptyPercent}%`}
            >
              <div
                style={{
                  background: "var(--admin-stat-active)",
                  width: `${activePercent}%`,
                }}
              />
              <div
                style={{
                  background: "var(--admin-stat-danger)",
                  width: `${emptyPercent}%`,
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-default-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-(--admin-stat-active)" />
                活跃 {activePercent}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-(--admin-stat-danger)" />
                空缓存 {emptyPercent}%
              </span>
            </div>
          </div>

          <div className="grid divide-y divide-(--admin-stat-split) text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
            {statItems.map((item) => (
              <div key={item.label} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${item.tone} 12%, transparent)`,
                      color: item.tone,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-xs font-medium text-default-500">
                    {item.width}%
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-default-500">
                      {item.helper}
                    </p>
                  </div>
                  <span className="text-2xl font-semibold text-foreground">
                    {item.value}
                    {item.suffix ? (
                      <span className="ml-1 text-xs font-medium text-default-500">
                        {item.suffix}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-(--surface-secondary)"
                  aria-label={`${item.label}占比 ${item.width}%`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: item.tone,
                      width: `${item.width}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 pb-0 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <DatabaseFilled className="text-xl text-accent" />
            <p className="mb-0! text-sm font-medium text-foreground">
              缓存分类
            </p>
            <span className="text-sm text-default-500">按数据来源清理缓存</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {cacheCategories.map((category) => {
            const Icon = category.Icon;
            const isEmpty = category.items === 0 && category.sizeKb === 0;
            const sizePercent = Math.round(
              (category.sizeKb / maxCategorySize) * 100,
            );

            return (
              <div
                key={category.key}
                className="overflow-hidden rounded-lg border border-(--admin-category-border) bg-(--surface)"
                style={
                  {
                    "--admin-category-border": token.colorBorderSecondary,
                    "--admin-category-split": token.colorSplit,
                  } as CSSProperties
                }
              >
                <div className="flex items-start justify-between gap-4 border-b border-(--admin-category-split) p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-accent"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 12%, transparent)",
                      }}
                    >
                      <Icon className="text-lg" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mb-0! text-sm font-medium text-foreground">
                          {category.title}
                        </p>
                        <Tag color={isEmpty ? "default" : "success"}>
                          {isEmpty ? "已清空" : "有缓存"}
                        </Tag>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-default-500">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid divide-y divide-(--admin-category-split) text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-4">
                    <p className="text-xs text-default-500">缓存项</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {category.items}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-default-500">存储大小</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatSize(category.sizeKb)}
                    </p>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--surface-secondary)"
                      aria-label={`${category.title}存储占比 ${sizePercent}%`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${sizePercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-(--admin-category-split) p-4">
                  <Button
                    danger
                    disabled={isEmpty}
                    size="small"
                    onClick={() => clearCategory(category.key)}
                  >
                    <DeleteOutlined />
                    清理缓存
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Divider className="my-0" />

        <div className="grid gap-4">
          <Alert
            className="rounded-lg"
            type="warning"
            title="清理所有缓存"
            description="注意：清理缓存后，相应的数据将需要重新从源服务器获取，可能会影响加载速度。"
          />
          <div className="flex justify-end">
            <Button danger size="small" onClick={clearAllCaches}>
              <DeleteFilled />
              清理所有缓存
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
