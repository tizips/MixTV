"use client";

import {
  FileTextOutlined,
  GithubOutlined,
  LinkOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Tag,
} from "antd";

type DanmakuConfig = {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  requestTimeoutSeconds: number;
  updatedAt: string | null;
};

type DanmakuFormValues = {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  requestTimeoutSeconds: number;
};

const defaultConfig: DanmakuConfig = {
  enabled: true,
  apiUrl: "https://smonedanmu.vercel.app",
  apiToken: "smonetv",
  requestTimeoutSeconds: 10,
  updatedAt: null,
};

function normalizeTimeout(value: string) {
  const timeout = Number(value);

  if (!Number.isFinite(timeout)) {
    return defaultConfig.requestTimeoutSeconds;
  }

  return Math.min(120, Math.max(1, Math.round(timeout)));
}

function normalizeConfig(payload: unknown): DanmakuConfig {
  const raw =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    enabled: raw.enabled === false ? false : true,
    apiUrl: typeof raw.apiUrl === "string" ? raw.apiUrl : defaultConfig.apiUrl,
    apiToken:
      typeof raw.apiToken === "string" ? raw.apiToken : defaultConfig.apiToken,
    requestTimeoutSeconds:
      typeof raw.requestTimeoutSeconds === "number"
        ? normalizeTimeout(String(raw.requestTimeoutSeconds))
        : defaultConfig.requestTimeoutSeconds,
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

async function readApiErrorMessage(response: Response, fallback: string) {
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

function normalizeEnabledInput(value: unknown) {
  return value === false || value === "false" ? false : true;
}

function normalizeApiUrlInput(value: string) {
  const trimmed = value.trim();
  return trimmed || defaultConfig.apiUrl;
}

function createSavePayload(config: Partial<DanmakuFormValues>) {
  return {
    enabled: normalizeEnabledInput(config.enabled),
    apiUrl: normalizeApiUrlInput(String(config.apiUrl ?? "")),
    apiToken: String(config.apiToken ?? "").trim(),
    requestTimeoutSeconds: normalizeTimeout(
      String(config.requestTimeoutSeconds),
    ),
  };
}

function validateDanmakuPayload(
  payload: Pick<DanmakuFormValues, "apiToken" | "apiUrl"> &
    Partial<Pick<DanmakuFormValues, "requestTimeoutSeconds">>,
) {
  if (!payload.apiToken.trim()) {
    return "请输入弹幕访问令牌。";
  }

  if (!payload.apiUrl.trim()) {
    return "请输入弹幕服务地址。";
  }

  if (!isValidHttpUrl(payload.apiUrl)) {
    return "请输入有效的弹幕服务地址。";
  }

  if (payload.requestTimeoutSeconds === undefined) {
    return null;
  }

  if (
    !Number.isInteger(payload.requestTimeoutSeconds) ||
    payload.requestTimeoutSeconds < 1
  ) {
    return "请求超时时间至少为 1 秒。";
  }

  if (payload.requestTimeoutSeconds > 120) {
    return "请求超时时间不能超过 120 秒。";
  }

  return null;
}

function createFormValues(config: DanmakuConfig): DanmakuFormValues {
  return {
    enabled: config.enabled,
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    requestTimeoutSeconds: config.requestTimeoutSeconds,
  };
}

let danmakuConfigLoadRequest: Promise<DanmakuConfig> | null = null;

export function resetDanmakuPanelState() {
  danmakuConfigLoadRequest = null;
}

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
  const { message: msg } = App.useApp();
  const [form] = Form.useForm<DanmakuFormValues>();
  const [config, setConfig] = useState<DanmakuConfig>(defaultConfig);
  const [loadMessage, setLoadMessage] = useState("尚未加载");
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
          form.setFieldsValue(createFormValues(nextConfig));
          setLoadMessage("已加载配置");
          msg.success("弹幕配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "弹幕配置读取失败";
          msg.error(message);
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
  }, [form, msg]);

  const saveConfig = async (values: DanmakuFormValues) => {
    const payload = createSavePayload(values);
    const validationMessage = validateDanmakuPayload(payload);

    if (validationMessage) {
      msg.error(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/danmaku", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "弹幕配置保存失败"),
        );
      }

      const savedConfig = normalizeConfig(await response.json());
      setConfig(savedConfig);
      form.setFieldsValue(createFormValues(savedConfig));
      msg.success("弹幕配置已保存");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "弹幕配置保存失败";
      msg.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    const payload = {
      apiUrl: normalizeApiUrlInput(String(form.getFieldValue("apiUrl") ?? "")),
      apiToken: String(form.getFieldValue("apiToken") ?? "").trim(),
    };
    const validationMessage = validateDanmakuPayload(payload);

    if (validationMessage) {
      msg.error(validationMessage);
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/admin/danmaku/test", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "弹幕连接测试失败"),
        );
      }

      msg.success("弹幕连接测试成功");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "弹幕连接测试失败";
      msg.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileTextOutlined className="text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                弹幕配置
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              管理播放页弹幕服务的开关、服务地址、访问令牌和请求超时，前台播放能力会直接读取这里的配置。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Tag color="blue">{loadMessage}</Tag>
            <Tag color={config.enabled ? "green" : "gold"}>
              {config.enabled ? "已启用" : "已停用"}
            </Tag>
          </div>
        </div>
      </div>

      <Form
        id="danmaku-config-form"
        form={form}
        layout="vertical"
        onFinish={saveConfig}
      >
        <Alert
          type={config.enabled ? "success" : "warning"}
          title={config.enabled ? "弹幕服务已启用" : "弹幕服务当前关闭"}
          description="默认服务为 https://smonedanmu.vercel.app，默认令牌为 smonetv。自建服务时建议先完成一次连接测试再保存。"
          action={
            <a
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-default-300 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100"
              href="https://github.com/huangxd-/danmu_api"
              rel="noreferrer"
              target="_blank"
            >
              <GithubOutlined />
              查看项目
            </a>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
          <div>
            <p className="text-sm font-medium text-foreground">启用弹幕服务</p>
            <p className="text-xs leading-5 text-default-500">
              关闭后，前台播放页不会请求弹幕接口，也不会展示弹幕交互入口。
            </p>
          </div>
          <Form.Item name="enabled" valuePropName="checked" noStyle>
            <Switch
              aria-label="启用弹幕"
              disabled={isLoading}
              onChange={(enabled) =>
                setConfig((current) => ({ ...current, enabled }))
              }
            />
          </Form.Item>
        </div>

        <Form.Item
          className="pt-6"
          label="弹幕服务地址"
          name="apiUrl"
          help="填写弹幕 HTTP 服务根地址，保存后由播放相关接口按该地址发起请求。"
          rules={[{ required: true, type: "url" }]}
        >
          <Input placeholder="例如 https://smonedanmu.vercel.app" />
        </Form.Item>

        <Form.Item
          label="访问令牌"
          name="apiToken"
          help="请求弹幕服务时附带的鉴权令牌，建议和部署端保持一致。"
          rules={[{ required: true }]}
        >
          <Input placeholder="请输入 API TOKEN" />
        </Form.Item>

        <Form.Item
          label="请求超时时间（秒）"
          name="requestTimeoutSeconds"
          help="范围 1-120 秒，用于限制单次弹幕接口请求的最长等待时间。"
        >
          <InputNumber
            min={1}
            max={120}
            controls={false}
            className="w-full"
          />
        </Form.Item>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              htmlType="button"
              loading={isTesting}
              onClick={() => void testConnection()}
            >
              <LinkOutlined />
              {isTesting ? "测试中" : "测试链接"}
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              <SaveOutlined />
              保存配置
            </Button>
          </div>
        </div>
      </Form>
    </Card>
  );
}
