"use client";

import { LayoutOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Alert, App, Card, Switch, Tag } from "antd";

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

const homepageModuleItems: HomepageModuleItem[] = [
  {
    key: "welcome-announcement",
    label: "欢迎公告",
    description: "展示首页欢迎语或站点公告入口。",
  },
  { key: "carousel", label: "焦点轮播", description: "首页顶部轮播推荐内容。" },
  {
    key: "continue-watching",
    label: "继续观看",
    description: "展示用户最近播放进度。",
  },
  { key: "coming-soon", label: "即将上映", description: "展示近期上线内容。" },
  {
    key: "trending-movies",
    label: "热门电影",
    description: "展示当前热门电影列表。",
  },
  {
    key: "trending-series",
    label: "热门剧集",
    description: "展示当前热门剧集列表。",
  },
  { key: "new-anime", label: "新番放送", description: "展示新番更新与热播。" },
  {
    key: "trending-variety",
    label: "热门综艺",
    description: "展示热门综艺节目。",
  },
  {
    key: "trending-short-dramas",
    label: "热门短剧",
    description: "展示热门短剧推荐。",
  },
];

function buildDefaultStates() {
  return homepageModuleItems.reduce<Record<HomepageModuleKey, boolean>>(
    (acc, item) => {
      acc[item.key] = true;
      return acc;
    },
    {} as Record<HomepageModuleKey, boolean>,
  );
}

function formatLastUpdated(value: string | null) {
  if (!value) {
    return "未保存";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function normalizeHomepageConfigResponse(
  payload: unknown,
): HomepageConfigResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const modulesPayload =
    raw.modules &&
    typeof raw.modules === "object" &&
    !Array.isArray(raw.modules)
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
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

let homepageConfigLoadRequest: Promise<HomepageConfigResponse> | null = null;

export function resetHomepageConfigPanelState() {
  homepageConfigLoadRequest = null;
}

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

function isHomepageModuleKey(value: unknown): value is HomepageModuleKey {
  return (
    typeof value === "string" &&
    homepageModuleKeys.includes(value as HomepageModuleKey)
  );
}

function parseHomepageSwitchPayload(key: HomepageModuleKey, value: boolean) {
  if (!isHomepageModuleKey(key)) {
    return { message: "表单校验失败。" };
  }

  if (typeof value !== "boolean") {
    return { message: "表单校验失败。" };
  }

  return { data: { key, value } };
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
  const { message: msg } = App.useApp();
  const [moduleStates, setModuleStates] = useState<
    Record<HomepageModuleKey, boolean>
  >(() => buildDefaultStates());
  const [isLoading, setIsLoading] = useState(true);
  const [savingModuleKey, setSavingModuleKey] =
    useState<HomepageModuleKey | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const enabledCount = homepageModuleItems.filter(
    (item) => moduleStates[item.key],
  ).length;

  useEffect(() => {
    let cancelled = false;

    async function loadHomepageConfig() {
      setIsLoading(true);

      try {
        const data = await loadHomepageConfigOnce();

        if (!cancelled) {
          setModuleStates(data.modules);
          setLastUpdated(data.updatedAt);
          msg.success("首页配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "首页配置读取失败";
          msg.error(message);
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
  }, [msg]);

  const saveSwitch = async (key: HomepageModuleKey, value: boolean) => {
    const parsedSwitch = parseHomepageSwitchPayload(key, value);

    if ("message" in parsedSwitch) {
      msg.error(parsedSwitch.message);
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
        throw new Error(
          await readApiErrorMessage(response, "首页模块配置保存失败"),
        );
      }

      const data = normalizeHomepageConfigResponse(await response.json());
      setModuleStates(data.modules);
      setLastUpdated(data.updatedAt);
      msg.success("首页模块配置已保存");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "首页模块配置保存失败";
      setModuleStates((current) => ({ ...current, [key]: previousValue }));
      msg.error(message);
    } finally {
      setSavingModuleKey(null);
    }
  };

  return (
    <div className="relative">
      <Card loading={isLoading}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <LayoutOutlined className="text-2xl text-accent" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    首页模块配置
                  </h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                通过首页模块开关控制各分区显示状态，开关调整后会立即写入配置接口。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag color="processing">
                {isLoading
                  ? "加载中"
                  : `已启用 ${enabledCount} / ${homepageModuleItems.length}`}
              </Tag>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">首页模块</p>
          <p className="text-sm text-default-500">
            最后更新时间 {formatLastUpdated(lastUpdated)}
          </p>
        </div>

        <div className="grid gap-3">
          {homepageModuleItems.map((item) => (
            <Alert
              key={item.key}
              title={item.label}
              description={item.description}
              type={moduleStates[item.key] ? "success" : "info"}
              action={
                <Switch
                  checked={moduleStates[item.key]}
                  disabled={isLoading}
                  loading={savingModuleKey === item.key}
                  aria-label={`切换${item.label}`}
                  onChange={(enabled) => void saveSwitch(item.key, enabled)}
                />
              }
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
