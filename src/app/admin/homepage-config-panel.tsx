"use client";

import { useState } from "react";
import { Button, Card, Chip, ListBox, Switch } from "@heroui/react";

type HomepageModuleKey =
  | "carousel"
  | "continue-watching"
  | "coming-soon"
  | "trending-movies"
  | "trending-series"
  | "new-anime"
  | "trending-variety"
  | "trending-short-dramas";

type HomepageModuleItem = {
  key: HomepageModuleKey;
  label: string;
  description: string;
};

const homepageModuleItems: HomepageModuleItem[] = [
  { key: "carousel", label: "焦点轮播", description: "首页顶部轮播推荐内容。" },
  { key: "continue-watching", label: "继续观看", description: "展示用户最近播放进度。" },
  { key: "coming-soon", label: "即将上映", description: "展示近期上线内容。" },
  { key: "trending-movies", label: "热门电影", description: "展示当前热门电影列表。" },
  { key: "trending-series", label: "热门剧集", description: "展示当前热门剧集列表。" },
  { key: "new-anime", label: "新番放送", description: "展示新番更新与热播。" },
  { key: "trending-variety", label: "热门综艺", description: "展示热门综艺节目。" },
  { key: "trending-short-dramas", label: "热门短剧", description: "展示热门短剧推荐。" },
];

function buildDefaultStates() {
  return homepageModuleItems.reduce<Record<HomepageModuleKey, boolean>>((acc, item) => {
    acc[item.key] = true;
    return acc;
  }, {} as Record<HomepageModuleKey, boolean>);
}

export function HomepageConfigPanel() {
  const [moduleStates, setModuleStates] = useState<Record<HomepageModuleKey, boolean>>(() => buildDefaultStates());
  const enabledCount = homepageModuleItems.filter((item) => moduleStates[item.key]).length;

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-3 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-layout-text-window-reverse text-2xl text-violet-300" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">首页模块配置</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              通过首页模块开关控制各分区显示状态，当前保存行为为本地 Mock。
            </p>
          </div>

          <Chip color="accent" variant="soft">
            已启用 {enabledCount} / {homepageModuleItems.length}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 md:p-8 md:pt-5">
        <ListBox aria-label="Homepage modules" className="space-y-3 rounded-3xl bg-background/50 p-4">
          {homepageModuleItems.map((item) => (
            <ListBox.Item
              key={item.key}
              id={item.key}
              textValue={item.label}
              className="w-full rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-default-500">{item.description}</p>
                </div>
                <Switch
                  className="ml-auto shrink-0"
                  isSelected={moduleStates[item.key]}
                  onChange={() =>
                    setModuleStates((current) => ({
                      ...current,
                      [item.key]: !current[item.key],
                    }))
                  }
                  aria-label={`切换${item.label}`}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>

        <div className="flex justify-end">
          <Button variant="primary">保存配置</Button>
        </div>
      </Card.Content>
    </Card>
  );
}
