"use client";

import { useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, Switch, TextArea } from "@heroui/react";

function formatLastUpdated(date: Date | null) {
  if (!date) {
    return "未拉取";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

type SubscriptionResponse = {
  autoUpdate: boolean;
  updatedAt: string | null;
  url?: string;
};

type ConfigContentResponse = {
  content: string;
  updatedAt: string | null;
};

type ConfigFilesResponse = {
  content: ConfigContentResponse;
  subscription: SubscriptionResponse;
};

function normalizeConfigFilesResponse(payload: unknown): ConfigFilesResponse {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rawContent =
    raw.content && typeof raw.content === "object" ? (raw.content as Record<string, unknown>) : {};
  const rawSubscription =
    raw.subscription && typeof raw.subscription === "object"
      ? (raw.subscription as Record<string, unknown>)
      : {};

  return {
    content: {
      content: typeof rawContent.content === "string" ? rawContent.content : "",
      updatedAt: typeof rawContent.updatedAt === "string" || rawContent.updatedAt === null ? rawContent.updatedAt : null,
    },
    subscription: {
      autoUpdate: rawSubscription.autoUpdate === true,
      updatedAt:
        typeof rawSubscription.updatedAt === "string" || rawSubscription.updatedAt === null
          ? rawSubscription.updatedAt
          : null,
      url: typeof rawSubscription.url === "string" ? rawSubscription.url : "",
    },
  };
}

function parseUpdatedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestUpdatedAt(...values: Array<string | null>) {
  const dates = values.flatMap((value) => {
    const date = parseUpdatedAt(value);
    return date ? [date] : [];
  });

  if (dates.length === 0) {
    return null;
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function ConfigFilesPanel() {
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [configText, setConfigText] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState("正在加载配置");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [isSavingAutoUpdate, setIsSavingAutoUpdate] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const isMaskLoading = isLoading || isSavingSubscription || isSavingAutoUpdate || isSavingContent;

  const loadConfigFiles = async () => {
    const response = await fetch("/api/admin/files");

    if (!response.ok) {
      throw new Error("配置读取失败");
    }

    return normalizeConfigFilesResponse(await response.json());
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialConfigFiles() {
      setIsLoading(true);

      try {
        const data = await loadConfigFiles();

        if (!cancelled) {
          setSubscriptionUrl(data.subscription.url ?? "");
          setAutoUpdate(data.subscription.autoUpdate);
          setConfigText(data.content.content);
          setLastUpdated(getLatestUpdatedAt(data.subscription.updatedAt, data.content.updatedAt));
          setStatusMessage("配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : "配置读取失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialConfigFiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const pullConfig = async () => {
    setIsLoading(true);
    setIsSavingSubscription(true);

    try {
      const response = await fetch("/api/admin/files/subscription/pull", {
        body: JSON.stringify({ url: subscriptionUrl }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("订阅配置保存失败");
      }

      const data = (await response.json()) as SubscriptionResponse;
      setSubscriptionUrl(data.url ?? "");
      setAutoUpdate(data.autoUpdate);
      setLastUpdated(parseUpdatedAt(data.updatedAt));

      const configFiles = await loadConfigFiles();
      setConfigText(configFiles.content.content);
      setLastUpdated(getLatestUpdatedAt(configFiles.subscription.updatedAt, configFiles.content.updatedAt));
      setStatusMessage("配置已拉取并保存");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "配置拉取保存失败");
    } finally {
      setIsLoading(false);
      setIsSavingSubscription(false);
    }
  };

  const saveAutoUpdate = async (nextAutoUpdate: boolean) => {
    const previousAutoUpdate = autoUpdate;
    setAutoUpdate(nextAutoUpdate);
    setIsSavingAutoUpdate(true);

    try {
      const response = await fetch("/api/admin/files/subscription/auto-update", {
        body: JSON.stringify({ autoUpdate: nextAutoUpdate }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("自动更新配置保存失败");
      }

      const data = (await response.json()) as SubscriptionResponse;
      setAutoUpdate(data.autoUpdate);
      setLastUpdated(parseUpdatedAt(data.updatedAt));
      setStatusMessage(data.autoUpdate ? "自动更新已开启" : "自动更新已关闭");
    } catch (error) {
      setAutoUpdate(previousAutoUpdate);
      setStatusMessage(error instanceof Error ? error.message : "自动更新配置保存失败");
    } finally {
      setIsSavingAutoUpdate(false);
    }
  };

  const saveConfig = async () => {
    setIsSavingContent(true);

    try {
      const response = await fetch("/api/admin/files/content", {
        body: JSON.stringify({ content: configText }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("配置内容保存失败");
      }

      const data = (await response.json()) as ConfigContentResponse;
      setConfigText(data.content);
      setLastUpdated(parseUpdatedAt(data.updatedAt));
      setStatusMessage("配置内容已保存");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "配置内容保存失败");
    } finally {
      setIsSavingContent(false);
    }
  };

  return (
    <div className="relative">
      {isMaskLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-default-200 bg-background/90 px-4 py-2 text-sm text-default-700 shadow-sm">
            <i aria-hidden="true" className="bi bi-arrow-repeat animate-spin text-base" />
            <span>处理中...</span>
          </div>
        </div>
      ) : null}
      <Card>
        <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-folder2-open text-2xl text-accent" />
                <div>
                  {/* <p className="text-sm font-medium uppercase tracking-[0.24em] text-default-500">配置文件</p> */}
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">配置文件</h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                这里显示拉取下来的内容，也可以手动修改后保存。
              </p>
            </div>

            <Chip color={autoUpdate ? "success" : "warning"}>
              {isLoading ? "加载中" : statusMessage || (autoUpdate ? "自动更新开启" : "自动更新关闭")}
            </Chip>
          </div>
        </Card.Header>

        <Card.Content className="gap-5 p-6 pt-5 md:p-8 md:pt-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="subscription-url">订阅链接</Label>
              <p className="text-sm text-default-500">最后更新时间 {formatLastUpdated(lastUpdated)}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="subscription-url"
                className="min-w-0 flex-1"
                value={subscriptionUrl}
                onChange={(event) => setSubscriptionUrl(event.target.value)}
                placeholder="输入订阅链接"
              />
              <Button
                variant="primary"
                onPress={pullConfig}
                isDisabled={!subscriptionUrl.trim() || isLoading || isSavingAutoUpdate}
              >
                <i aria-hidden="true" className="bi bi-save" />
                {isSavingSubscription ? "拉取中" : "拉取配置"}
              </Button>
            </div>
            <p className="text-xs leading-5 text-default-500">
              输入配置文件的订阅地址，要求 JSON 格式，且使用 Base58 编码。
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">自动更新</p>
              <p className="text-xs text-default-500">开启后可自动同步订阅内容。</p>
            </div>
            <Switch
              isSelected={autoUpdate}
              onChange={saveAutoUpdate}
              aria-label="自动更新"
              isDisabled={isLoading || isSavingAutoUpdate || isSavingSubscription}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="config-content">配置内容</Label>
              <Button variant="outline" onPress={saveConfig} isDisabled={isLoading}>
                {isSavingContent ? "保存中" : "保存"}
              </Button>
            </div>
            <TextArea
              id="config-content"
              className="w-full"
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              placeholder="配置内容将显示在这里"
              rows={11}
            />
            <p className="text-sm text-default-500">支持 JSON 格式，用于配置视频源。</p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
