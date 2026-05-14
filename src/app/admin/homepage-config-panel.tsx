"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Card, Chip, ListBox, Switch, toast } from "@heroui/react";

type HomepageModuleKey =
  | "carousel"
  | "welcome-announcement"
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

type HomepageConfigResponse = {
  modules: Record<HomepageModuleKey, boolean>;
  updatedAt: string | null;
};

const homepageModuleKeys = [
  "carousel",
  "welcome-announcement",
  "continue-watching",
  "coming-soon",
  "trending-movies",
  "trending-series",
  "new-anime",
  "trending-variety",
  "trending-short-dramas",
] as const;

const homepageSwitchSchema = z.object({
  key: z.enum(homepageModuleKeys),
  value: z.boolean(),
});

const homepageModuleItems: HomepageModuleItem[] = [
  { key: "welcome-announcement", label: "欢迎公告", description: "展示首页欢迎语或站点公告入口。" },
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

function normalizeHomepageConfigResponse(payload: unknown): HomepageConfigResponse {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const modulesPayload =
    raw.modules && typeof raw.modules === "object" && !Array.isArray(raw.modules)
      ? (raw.modules as Record<string, unknown>)
      : {};
  const modules = buildDefaultStates();

  for (const item of homepageModuleItems) {
    const moduleValue = modulesPayload[item.key];
    if (typeof moduleValue === "boolean") {
      modules[item.key] = moduleValue;
    }
  }

  return {
    modules,
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
  };
}

let homepageConfigLoadRequest: Promise<HomepageConfigResponse> | null = null;

async function fetchHomepageConfig() {
  const response = await fetch("/api/admin/homepage");

  if (!response.ok) {
    throw new Error("首页配置读取失败");
  }

  return normalizeHomepageConfigResponse(await response.json());
}

async function readApiErrorMessage(response: Response, fallback: string) {
  if (response.status !== 400) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as unknown;

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const message = (payload as Record<string, unknown>).message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "表单校验失败。";
}

function loadHomepageConfigOnce() {
  if (homepageConfigLoadRequest) {
    return homepageConfigLoadRequest;
  }

  const request = fetchHomepageConfig();
  homepageConfigLoadRequest = request;

  void request
    .finally(() => {
      if (homepageConfigLoadRequest === request) {
        homepageConfigLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

export function HomepageConfigPanel() {
  const [moduleStates, setModuleStates] = useState<Record<HomepageModuleKey, boolean>>(() => buildDefaultStates());
  const [isLoading, setIsLoading] = useState(true);
  const [savingModuleKey, setSavingModuleKey] = useState<HomepageModuleKey | null>(null);
  const enabledCount = homepageModuleItems.filter((item) => moduleStates[item.key]).length;

  useEffect(() => {
    let cancelled = false;

    async function loadHomepageConfig() {
      setIsLoading(true);

      try {
        const data = await loadHomepageConfigOnce();

        if (!cancelled) {
          setModuleStates(data.modules);
          toast.success("首页配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "首页配置读取失败";
          toast.danger(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHomepageConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSwitch = async (key: HomepageModuleKey, value: boolean) => {
    const parsedSwitch = homepageSwitchSchema.safeParse({ key, value });

    if (!parsedSwitch.success) {
      toast.danger(getZodErrorMessage(parsedSwitch.error));
      return;
    }

    const previousValue = moduleStates[key];

    setModuleStates((current) => ({ ...current, [key]: value }));
    setSavingModuleKey(key);

    try {
      const response = await fetch("/api/admin/homepage/switch", {
        body: JSON.stringify(parsedSwitch.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "首页模块配置保存失败"));
      }

      const data = normalizeHomepageConfigResponse(await response.json());
      setModuleStates(data.modules);
      toast.success("首页模块配置已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "首页模块配置保存失败";
      setModuleStates((current) => ({ ...current, [key]: previousValue }));
      toast.danger(message);
    } finally {
      setSavingModuleKey(null);
    }
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-3 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-layout-text-window-reverse text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">首页模块配置</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              通过首页模块开关控制各分区显示状态，开关调整后会立即写入配置接口。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip color="accent" variant="soft">
              已启用 {enabledCount} / {homepageModuleItems.length}
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 md:p-8 md:pt-5">
        <ListBox aria-label="Homepage modules" className="space-y-3 rounded-3xl p-4">
          {homepageModuleItems.map((item) => (
            <ListBox.Item
              key={item.key}
              id={item.key}
              textValue={item.label}
              className="w-full rounded-2xl border px-4 py-3"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-default-500">{item.description}</p>
                </div>
                <Switch
                  className="ml-auto shrink-0"
                  isDisabled={isLoading || savingModuleKey === item.key}
                  isSelected={moduleStates[item.key]}
                  onChange={(enabled) => void saveSwitch(item.key, enabled)}
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
      </Card.Content>
    </Card>
  );
}
