"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Chip, Separator } from "@heroui/react";

type CacheCategory = {
  key: string;
  icon: string;
  title: string;
  description: string;
  items: number;
  sizeKb: number;
};

const initialCacheCategories: CacheCategory[] = [
  {
    key: "douban",
    icon: "bi-star-half",
    title: "豆瓣数据",
    description: "缓存豆瓣评分、简介、海报和演员信息。",
    items: 128,
    sizeKb: 18432,
  },
  {
    key: "danmaku",
    icon: "bi-chat-square-text",
    title: "弹幕数据",
    description: "缓存弹幕源查询结果和视频弹幕索引。",
    items: 86,
    sizeKb: 9216,
  },
  {
    key: "tmdb",
    icon: "bi-film",
    title: "TMDB数据",
    description: "缓存 TMDB 剧集、电影、季集和图片元数据。",
    items: 214,
    sizeKb: 32768,
  },
  {
    key: "short-drama",
    icon: "bi-collection-play",
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
  const [cacheCategories, setCacheCategories] = useState(initialCacheCategories);
  const [statusMessage, setStatusMessage] = useState("缓存统计已加载");

  const cacheStats = useMemo(() => {
    const totalItems = cacheCategories.reduce((total, category) => total + category.items, 0);
    const totalSizeKb = cacheCategories.reduce((total, category) => total + category.sizeKb, 0);
    const activeTypes = cacheCategories.filter((category) => category.items > 0).length;

    return {
      totalItems,
      totalSize: formatSize(totalSizeKb),
      activeTypes,
    };
  }, [cacheCategories]);

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
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-database-fill-gear text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">缓存管理</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              查看缓存数据统计，按分类清理站点聚合数据，或一次性释放全部缓存占用。
            </p>
          </div>

          <Chip color="accent" variant="soft">
            {statusMessage}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 md:p-8 md:pt-5">
        <section className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-default-500">缓存数据统计</p>
              <p className="text-base font-semibold text-foreground">当前缓存概览</p>
            </div>
            <Button variant="outline" onPress={refreshStats}>
              <i aria-hidden="true" className="bi bi-arrow-clockwise" />
              刷新
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="overflow-hidden border border-accent-soft bg-accent-soft" variant="secondary">
              <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 text-accent-soft-foreground">
                  <i aria-hidden="true" className="bi bi-stack text-lg" />
                </span>
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm font-medium text-default-500">缓存项总数</p>
                  <p className="text-xs leading-5 text-default-500">全部缓存分类的记录数量</p>
                </div>
              </Card.Header>
              <Card.Content className="px-5 pt-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold text-foreground">{cacheStats.totalItems}</p>
                  <Chip color="accent" size="sm" variant="soft">
                    项
                  </Chip>
                </div>
              </Card.Content>
            </Card>

            <Card className="overflow-hidden border border-accent-soft bg-accent-soft" variant="secondary">
              <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 text-accent-soft-foreground">
                  <i aria-hidden="true" className="bi bi-hdd text-lg" />
                </span>
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm font-medium text-default-500">占用存储空间</p>
                  <p className="text-xs leading-5 text-default-500">当前缓存估算磁盘占用</p>
                </div>
              </Card.Header>
              <Card.Content className="px-5 pt-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold text-foreground">{cacheStats.totalSize}</p>
                  <Chip color="accent" size="sm" variant="soft">
                    空间
                  </Chip>
                </div>
              </Card.Content>
            </Card>

            <Card className="overflow-hidden border border-accent-soft bg-accent-soft" variant="secondary">
              <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 text-accent-soft-foreground">
                  <i aria-hidden="true" className="bi bi-grid-3x3-gap text-lg" />
                </span>
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm font-medium text-default-500">缓存类型</p>
                  <p className="text-xs leading-5 text-default-500">仍有数据的缓存分类</p>
                </div>
              </Card.Header>
              <Card.Content className="px-5 pt-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold text-foreground">{cacheStats.activeTypes}</p>
                  <Chip color="accent" size="sm" variant="soft">
                    类型
                  </Chip>
                </div>
              </Card.Content>
            </Card>
          </div>
        </section>

        <Separator />

        <section className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-default-500">缓存分类</p>
            <p className="text-base font-semibold text-foreground">按数据来源清理</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {cacheCategories.map((category) => (
              <Card key={category.key}>
                <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-default-200 bg-background text-accent">
                    <i aria-hidden="true" className={`bi ${category.icon} text-lg`} />
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <p className="text-base font-semibold text-foreground">{category.title}</p>
                    <p className="text-sm leading-6 text-default-600">{category.description}</p>
                  </div>
                </Card.Header>
                <Card.Content className="grid gap-4 px-5 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-accent-soft bg-accent-soft px-3 py-2">
                      <p className="text-xs text-default-500">缓存项</p>
                      <p className="text-base font-semibold text-foreground">{category.items}</p>
                    </div>
                    <div className="rounded-xl border border-accent-soft bg-accent-soft px-3 py-2">
                      <p className="text-xs text-default-500">存储大小</p>
                      <p className="text-base font-semibold text-foreground">{formatSize(category.sizeKb)}</p>
                    </div>
                  </div>
                  <Button fullWidth variant="danger-soft" onPress={() => clearCategory(category.key)}>
                    <i aria-hidden="true" className="bi bi-trash3" />
                    清理缓存
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="grid gap-4">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>清理所有缓存</Alert.Title>
              <Alert.Description>
                注意：清理缓存后，相应的数据将需要重新从源服务器获取，可能会影响加载速度。
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <Button fullWidth variant="danger" onPress={clearAllCaches}>
            <i aria-hidden="true" className="bi bi-trash3-fill" />
            清理所有缓存
          </Button>
        </section>
      </Card.Content>
    </Card>
  );
}
