"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, Switch, TextField, toast } from "@heroui/react";

type DanmakuConfig = {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  requestTimeoutSeconds: number;
  updatedAt: string | null;
};

const defaultConfig: DanmakuConfig = {
  enabled: true,
  apiUrl: "https://smonedanmu.vercel.app",
  apiToken: "smonetv",
  requestTimeoutSeconds: 10,
  updatedAt: null,
};

const danmakuConfigSchema = z.object({
  enabled: z.boolean(),
  apiToken: z.string().trim().min(1, "请输入弹幕访问令牌。"),
  apiUrl: z.string().trim().min(1, "请输入弹幕服务地址。"),
  requestTimeoutSeconds: z.number().int().min(1, "请求超时时间至少为 1 秒。").max(120, "请求超时时间不能超过 120 秒。"),
});

function normalizeTimeout(value: string) {
  const timeout = Number(value);

  if (!Number.isFinite(timeout)) {
    return defaultConfig.requestTimeoutSeconds;
  }

  return Math.min(120, Math.max(1, Math.round(timeout)));
}

function normalizeConfig(payload: unknown): DanmakuConfig {
  const raw = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

  return {
    enabled: raw.enabled === false ? false : true,
    apiUrl: typeof raw.apiUrl === "string" ? raw.apiUrl : defaultConfig.apiUrl,
    apiToken: typeof raw.apiToken === "string" ? raw.apiToken : defaultConfig.apiToken,
    requestTimeoutSeconds:
      typeof raw.requestTimeoutSeconds === "number"
        ? normalizeTimeout(String(raw.requestTimeoutSeconds))
        : defaultConfig.requestTimeoutSeconds,
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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "表单校验失败。";
}

function createSavePayload(config: DanmakuConfig) {
  return {
    enabled: config.enabled,
    apiUrl: config.apiUrl.trim(),
    apiToken: config.apiToken.trim(),
    requestTimeoutSeconds: config.requestTimeoutSeconds,
  };
}

let danmakuConfigLoadRequest: Promise<DanmakuConfig> | null = null;

async function fetchDanmakuConfig() {
  const response = await fetch("/api/admin/danmaku");

  if (!response.ok) {
    throw new Error("弹幕配置读取失败");
  }

  return normalizeConfig(await response.json());
}

function loadDanmakuConfigOnce() {
  if (danmakuConfigLoadRequest) {
    return danmakuConfigLoadRequest;
  }

  const request = fetchDanmakuConfig();
  danmakuConfigLoadRequest = request;

  void request
    .finally(() => {
      if (danmakuConfigLoadRequest === request) {
        danmakuConfigLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

export function DanmakuPanel() {
  const [config, setConfig] = useState<DanmakuConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoading(true);

      try {
        const nextConfig = await loadDanmakuConfigOnce();

        if (!cancelled) {
          setConfig(nextConfig);
          toast.success("弹幕配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "弹幕配置读取失败";
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
    const parsed = danmakuConfigSchema.safeParse(createSavePayload(config));

    if (!parsed.success) {
      toast.danger(getZodErrorMessage(parsed.error));
      return;
    }

    if (!isValidHttpUrl(parsed.data.apiUrl)) {
      toast.danger("请输入有效的弹幕服务地址。");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/danmaku", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "弹幕配置保存失败"));
      }

      setConfig(normalizeConfig(await response.json()));
      toast.success("弹幕配置已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "弹幕配置保存失败";
      toast.danger(message);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    const parsed = danmakuConfigSchema.pick({ apiToken: true, apiUrl: true }).safeParse({
      apiUrl: config.apiUrl.trim(),
      apiToken: config.apiToken.trim(),
    });

    if (!parsed.success) {
      toast.danger(getZodErrorMessage(parsed.error));
      return;
    }

    if (!isValidHttpUrl(parsed.data.apiUrl)) {
      toast.danger("请输入有效的弹幕服务地址。");
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/admin/danmaku/test", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "弹幕连接测试失败"));
      }

      toast.success("弹幕连接测试成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "弹幕连接测试失败";
      toast.danger(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-chat-square-text text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">弹幕配置</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              管理播放页弹幕服务的开关、服务地址、访问令牌和请求超时，前台播放能力会直接读取这里的配置。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Chip color={config.enabled ? "success" : "warning"} variant="soft">
              {config.enabled ? "已启用" : "已停用"}
            </Chip>
            <Chip color="accent" variant="soft">
              {config.requestTimeoutSeconds} 秒超时
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="space-y-6 p-6 pt-5 md:p-8 md:pt-5">
        <Alert status={config.enabled ? "accent" : "warning"}>
          <Alert.Indicator />
          <Alert.Content className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <Alert.Title>{config.enabled ? "弹幕服务已启用" : "弹幕服务当前关闭"}</Alert.Title>
              <Alert.Description>
                默认服务为 `https://smonedanmu.vercel.app`，默认令牌为 `smonetv`。自建服务时建议先完成一次连接测试再保存。
              </Alert.Description>
            </span>
            <a
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-default-300 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100"
              href="https://github.com/huangxd-/danmu_api"
              rel="noreferrer"
              target="_blank"
            >
              <i aria-hidden="true" className="bi bi-github" />
              查看项目
            </a>
          </Alert.Content>
        </Alert>

        <section className="rounded-3xl border border-default-200/80 bg-background/50 p-4 md:p-5">
          <Form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveConfig();
            }}
          >
            <div className="grid gap-3 rounded-2xl border border-default-200/80 bg-background/60 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">启用弹幕服务</p>
                <p className="text-xs leading-5 text-default-500">关闭后，前台播放页不会请求弹幕接口，也不会展示弹幕交互入口。</p>
              </div>
              <Switch
                aria-label="启用弹幕"
                isDisabled={isLoading}
                isSelected={config.enabled}
                onChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <TextField fullWidth name="apiUrl">
              <Label>弹幕服务地址</Label>
              <Input
                value={config.apiUrl}
                onChange={(event) => setConfig((current) => ({ ...current, apiUrl: event.target.value }))}
                placeholder="例如 https://smonedanmu.vercel.app"
              />
              <Description>填写弹幕 HTTP 服务根地址，保存后由播放相关接口按该地址发起请求。</Description>
            </TextField>

            <TextField fullWidth name="apiToken">
              <Label>访问令牌</Label>
              <Input
                value={config.apiToken}
                onChange={(event) => setConfig((current) => ({ ...current, apiToken: event.target.value }))}
                placeholder="请输入 API TOKEN"
              />
              <Description>请求弹幕服务时附带的鉴权令牌，建议和部署端保持一致。</Description>
            </TextField>

            <TextField fullWidth name="requestTimeoutSeconds">
              <Label>请求超时时间（秒）</Label>
              <Input
                inputMode="numeric"
                max={120}
                min={1}
                type="number"
                value={String(config.requestTimeoutSeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    requestTimeoutSeconds: normalizeTimeout(event.target.value),
                  }))
                }
              />
              <Description>范围 1-120 秒，用于限制单次弹幕接口请求的最长等待时间。</Description>
            </TextField>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-default-500">{config.updatedAt ? `最近保存：${config.updatedAt}` : "尚未保存过自定义配置"}</div>
              <div className="flex flex-wrap gap-3">
                <Button isDisabled={isTesting} variant="outline" type="button" onPress={() => void testConnection()}>
                  <i aria-hidden="true" className="bi bi-link-45deg" />
                  {isTesting ? "测试中" : "测试链接"}
                </Button>
                <Button isDisabled={isSaving} variant="primary" type="submit">
                  <i aria-hidden="true" className="bi bi-save" />
                  {isSaving ? "保存中" : "保存配置"}
                </Button>
              </div>
            </div>
          </Form>
        </section>
      </Card.Content>
    </Card>
  );
}
