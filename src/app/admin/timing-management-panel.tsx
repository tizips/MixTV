"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, Switch, TextField, toast } from "@heroui/react";

type TimingManagementConfig = {
  autoRefreshEnabled: boolean;
  maxRecordsPerRun: number;
  recentActiveDays: number;
  onlyRefreshOngoingSeries: boolean;
  maxSearchPages: number;
  siteCacheSeconds: number;
  updatedAt: string | null;
};

const defaultConfig: TimingManagementConfig = {
  autoRefreshEnabled: true,
  maxRecordsPerRun: 100,
  recentActiveDays: 30,
  onlyRefreshOngoingSeries: true,
  maxSearchPages: 3,
  siteCacheSeconds: 3600,
  updatedAt: null,
};

const timingManagementConfigSchema = z.object({
  autoRefreshEnabled: z.boolean(),
  maxRecordsPerRun: z.number().int().min(1, "每次最多处理记录数至少为 1。").max(1000, "每次最多处理记录数不能超过 1000。"),
  recentActiveDays: z.number().int().min(1, "最近活跃天数至少为 1 天。").max(365, "最近活跃天数不能超过 365 天。"),
  onlyRefreshOngoingSeries: z.boolean(),
  maxSearchPages: z.number().int().min(1, "最大页数至少为 1。").max(20, "最大页数不能超过 20。"),
  siteCacheSeconds: z.number().int().min(0, "缓存时间不能小于 0 秒。").max(86400, "缓存时间不能超过 86400 秒。"),
});

function normalizeInteger(value: string, fallback: number, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeConfig(payload: unknown): TimingManagementConfig {
  const raw = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

  return {
    autoRefreshEnabled:
      typeof raw.autoRefreshEnabled === "boolean" ? raw.autoRefreshEnabled : defaultConfig.autoRefreshEnabled,
    maxRecordsPerRun:
      typeof raw.maxRecordsPerRun === "number"
        ? normalizeInteger(String(raw.maxRecordsPerRun), defaultConfig.maxRecordsPerRun, 1, 1000)
        : defaultConfig.maxRecordsPerRun,
    recentActiveDays:
      typeof raw.recentActiveDays === "number"
        ? normalizeInteger(String(raw.recentActiveDays), defaultConfig.recentActiveDays, 1, 365)
        : defaultConfig.recentActiveDays,
    onlyRefreshOngoingSeries:
      typeof raw.onlyRefreshOngoingSeries === "boolean"
        ? raw.onlyRefreshOngoingSeries
        : defaultConfig.onlyRefreshOngoingSeries,
    maxSearchPages:
      typeof raw.maxSearchPages === "number"
        ? normalizeInteger(String(raw.maxSearchPages), defaultConfig.maxSearchPages, 1, 20)
        : defaultConfig.maxSearchPages,
    siteCacheSeconds:
      typeof raw.siteCacheSeconds === "number"
        ? normalizeInteger(String(raw.siteCacheSeconds), defaultConfig.siteCacheSeconds, 0, 86400)
        : defaultConfig.siteCacheSeconds,
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
  };
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

function createSavePayload(config: TimingManagementConfig) {
  return {
    autoRefreshEnabled: config.autoRefreshEnabled,
    maxRecordsPerRun: config.maxRecordsPerRun,
    maxSearchPages: config.maxSearchPages,
    onlyRefreshOngoingSeries: config.onlyRefreshOngoingSeries,
    recentActiveDays: config.recentActiveDays,
    siteCacheSeconds: config.siteCacheSeconds,
  };
}

let timingManagementConfigLoadRequest: Promise<TimingManagementConfig> | null = null;

async function fetchTimingManagementConfig() {
  const response = await fetch("/api/admin/timing-management");

  if (!response.ok) {
    throw new Error("定时管理配置读取失败");
  }

  return normalizeConfig(await response.json());
}

function loadTimingManagementConfigOnce() {
  if (timingManagementConfigLoadRequest) {
    return timingManagementConfigLoadRequest;
  }

  const request = fetchTimingManagementConfig();
  timingManagementConfigLoadRequest = request;

  void request
    .finally(() => {
      if (timingManagementConfigLoadRequest === request) {
        timingManagementConfigLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

export function TimingManagementPanel() {
  const [config, setConfig] = useState<TimingManagementConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoading(true);

      try {
        const nextConfig = await loadTimingManagementConfigOnce();

        if (!cancelled) {
          setConfig(nextConfig);
          toast.success("定时管理配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "定时管理配置读取失败";
          toast.danger(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = async () => {
    const parsed = timingManagementConfigSchema.safeParse(createSavePayload(config));

    if (!parsed.success) {
      toast.danger(getZodErrorMessage(parsed.error));
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/timing-management", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "定时管理配置保存失败"));
      }

      setConfig(normalizeConfig(await response.json()));
      toast.success("定时管理配置已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "定时管理配置保存失败";
      toast.danger(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-clock-history text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">定时管理</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              每天凌晨 1 点自动更新播放记录和收藏的剧集信息。关闭可减少服务器出站流量。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip color={config.autoRefreshEnabled ? "success" : "warning"} variant="soft">
              {config.autoRefreshEnabled ? "自动刷新开启" : "自动刷新关闭"}
            </Chip>
            <Chip color="accent" variant="soft">
              {config.updatedAt ? `最近保存 ${config.updatedAt}` : isLoading ? "正在加载配置" : "尚未保存过自定义配置"}
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="p-6 pt-5 md:p-8 md:pt-5">
        <Form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveConfig();
          }}
        >
          <Alert status={config.autoRefreshEnabled ? "accent" : "warning"}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{config.autoRefreshEnabled ? "自动刷新播放记录和收藏" : "自动刷新已关闭"}</Alert.Title>
              <Alert.Description>
                启用后，系统会在每日 01:00 批量刷新播放记录和收藏中的剧集元信息。
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">启用自动刷新播放记录和收藏</p>
              <p className="text-xs leading-5 text-default-500">关闭后定时任务不会主动请求站点接口。</p>
            </div>
            <Switch
              aria-label="启用自动刷新播放记录和收藏"
              isDisabled={isLoading}
              isSelected={config.autoRefreshEnabled}
              onChange={(autoRefreshEnabled) => setConfig((current) => ({ ...current, autoRefreshEnabled }))}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <TextField fullWidth name="maxRecordsPerRun">
              <Label>每次最多处理记录数</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={1000}
                type="number"
                value={String(config.maxRecordsPerRun)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    maxRecordsPerRun: normalizeInteger(event.target.value, defaultConfig.maxRecordsPerRun, 1, 1000),
                  }))
                }
              />
              <Description>范围 1-1000，用于控制单次任务批量大小。</Description>
            </TextField>

            <TextField fullWidth name="recentActiveDays">
              <Label>仅刷新最近活跃的记录</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={365}
                type="number"
                value={String(config.recentActiveDays)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    recentActiveDays: normalizeInteger(event.target.value, defaultConfig.recentActiveDays, 1, 365),
                  }))
                }
              />
              <Description>填写最近活跃天数，范围 1-365 天。</Description>
            </TextField>

            <TextField fullWidth name="maxSearchPages">
              <Label>搜索接口可拉取最大页数</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={20}
                type="number"
                value={String(config.maxSearchPages)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    maxSearchPages: normalizeInteger(event.target.value, defaultConfig.maxSearchPages, 1, 20),
                  }))
                }
              />
              <Description>限制刷新时向搜索接口翻页拉取的最大页数。</Description>
            </TextField>

            <TextField fullWidth name="siteCacheSeconds">
              <Label>站点接口缓存时间（秒）</Label>
              <Input
                inputMode="numeric"
                min={0}
                max={86400}
                type="number"
                value={String(config.siteCacheSeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    siteCacheSeconds: normalizeInteger(event.target.value, defaultConfig.siteCacheSeconds, 0, 86400),
                  }))
                }
              />
              <Description>范围 0-86400 秒，0 表示不缓存站点接口结果。</Description>
            </TextField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">仅刷新连载中的剧集</p>
              <p className="text-xs leading-5 text-default-500">开启后完结剧集会跳过，进一步减少出站请求。</p>
            </div>
            <Switch
              aria-label="仅刷新连载中的剧集"
              isDisabled={isLoading}
              isSelected={config.onlyRefreshOngoingSeries}
              onChange={(onlyRefreshOngoingSeries) =>
                setConfig((current) => ({ ...current, onlyRefreshOngoingSeries }))
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <Button variant="primary" type="submit" fullWidth>
            <i aria-hidden="true" className="bi bi-save" />
            {isSaving ? "保存中" : "保存配置"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}
