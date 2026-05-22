"use client";

import {
  ClockCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Alert, App, Button, Card, Form, InputNumber, Switch, Tag } from "antd";

type TimingManagementConfig = {
  autoRefreshEnabled: boolean;
  maxRecordsPerRun: number;
  recentActiveDays: number;
  onlyRefreshOngoingSeries: boolean;
  maxSearchPages: number;
  siteCacheSeconds: number;
  updatedAt: string | null;
};

type TimingManagementFormValues = {
  autoRefreshEnabled: boolean;
  maxRecordsPerRun: number;
  recentActiveDays: number;
  onlyRefreshOngoingSeries: boolean;
  maxSearchPages: number;
  siteCacheSeconds: number;
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

function normalizeInteger(
  value: string,
  fallback: number,
  min: number,
  max: number,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeConfig(payload: unknown): TimingManagementConfig {
  const raw =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    autoRefreshEnabled:
      typeof raw.autoRefreshEnabled === "boolean"
        ? raw.autoRefreshEnabled
        : defaultConfig.autoRefreshEnabled,
    maxRecordsPerRun:
      typeof raw.maxRecordsPerRun === "number"
        ? normalizeInteger(
            String(raw.maxRecordsPerRun),
            defaultConfig.maxRecordsPerRun,
            1,
            1000,
          )
        : defaultConfig.maxRecordsPerRun,
    recentActiveDays:
      typeof raw.recentActiveDays === "number"
        ? normalizeInteger(
            String(raw.recentActiveDays),
            defaultConfig.recentActiveDays,
            1,
            365,
          )
        : defaultConfig.recentActiveDays,
    onlyRefreshOngoingSeries:
      typeof raw.onlyRefreshOngoingSeries === "boolean"
        ? raw.onlyRefreshOngoingSeries
        : defaultConfig.onlyRefreshOngoingSeries,
    maxSearchPages:
      typeof raw.maxSearchPages === "number"
        ? normalizeInteger(
            String(raw.maxSearchPages),
            defaultConfig.maxSearchPages,
            1,
            20,
          )
        : defaultConfig.maxSearchPages,
    siteCacheSeconds:
      typeof raw.siteCacheSeconds === "number"
        ? normalizeInteger(
            String(raw.siteCacheSeconds),
            defaultConfig.siteCacheSeconds,
            0,
            86400,
          )
        : defaultConfig.siteCacheSeconds,
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

function normalizeBooleanInput(value: unknown) {
  return value === false || value === "false" ? false : true;
}

function createSavePayload(config: Partial<TimingManagementFormValues>) {
  return {
    autoRefreshEnabled: normalizeBooleanInput(config.autoRefreshEnabled),
    maxRecordsPerRun: normalizeInteger(
      String(config.maxRecordsPerRun),
      defaultConfig.maxRecordsPerRun,
      1,
      1000,
    ),
    maxSearchPages: normalizeInteger(
      String(config.maxSearchPages),
      defaultConfig.maxSearchPages,
      1,
      20,
    ),
    onlyRefreshOngoingSeries: normalizeBooleanInput(
      config.onlyRefreshOngoingSeries,
    ),
    recentActiveDays: normalizeInteger(
      String(config.recentActiveDays),
      defaultConfig.recentActiveDays,
      1,
      365,
    ),
    siteCacheSeconds: normalizeInteger(
      String(config.siteCacheSeconds),
      defaultConfig.siteCacheSeconds,
      0,
      86400,
    ),
  };
}

function validateIntegerRange(
  value: number,
  min: number,
  max: number,
  minMessage: string,
  maxMessage: string,
) {
  if (!Number.isInteger(value) || value < min) {
    return minMessage;
  }

  if (value > max) {
    return maxMessage;
  }

  return null;
}

function validateTimingManagementPayload(payload: TimingManagementFormValues) {
  return (
    validateIntegerRange(
      payload.maxRecordsPerRun,
      1,
      1000,
      "每次最多处理记录数至少为 1。",
      "每次最多处理记录数不能超过 1000。",
    ) ??
    validateIntegerRange(
      payload.recentActiveDays,
      1,
      365,
      "最近活跃天数至少为 1 天。",
      "最近活跃天数不能超过 365 天。",
    ) ??
    validateIntegerRange(
      payload.maxSearchPages,
      1,
      20,
      "最大页数至少为 1。",
      "最大页数不能超过 20。",
    ) ??
    validateIntegerRange(
      payload.siteCacheSeconds,
      0,
      86400,
      "缓存时间不能小于 0 秒。",
      "缓存时间不能超过 86400 秒。",
    )
  );
}

function createFormValues(
  config: TimingManagementConfig,
): TimingManagementFormValues {
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

export function resetTimingManagementPanelState() {
  timingManagementConfigLoadRequest = null;
}

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
  const { message: msg } = App.useApp();
  const [form] = Form.useForm<TimingManagementFormValues>();
  const [config, setConfig] = useState<TimingManagementConfig>(defaultConfig);
  const [loadMessage, setLoadMessage] = useState("尚未加载");
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
          form.setFieldsValue(createFormValues(nextConfig));
          setLoadMessage("已加载配置");
          msg.success("定时管理配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "定时管理配置读取失败";
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

  const saveConfig = async (values: TimingManagementFormValues) => {
    const payload = createSavePayload(values);
    const validationMessage = validateTimingManagementPayload(payload);

    if (validationMessage) {
      msg.error(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/timing-management", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "定时管理配置保存失败"),
        );
      }

      const savedConfig = normalizeConfig(await response.json());
      setConfig(savedConfig);
      form.setFieldsValue(createFormValues(savedConfig));
      msg.success("定时管理配置已保存");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "定时管理配置保存失败";
      msg.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfigValue = <Key extends keyof TimingManagementFormValues>(
    key: Key,
    value: TimingManagementFormValues[Key],
  ) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ClockCircleOutlined className="text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                定时管理
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              每天凌晨 1 点自动更新播放记录和收藏的剧集信息。关闭可减少服务器出站流量。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Tag color="blue">{loadMessage}</Tag>
            <Tag color={config.autoRefreshEnabled ? "green" : "gold"}>
              {config.autoRefreshEnabled ? "自动刷新开启" : "自动刷新关闭"}
            </Tag>
            {config.updatedAt ? (
              <Tag color="processing">最近保存 {config.updatedAt}</Tag>
            ) : null}
          </div>
        </div>
      </div>

      <Form
        id="timing-management-config-form"
        form={form}
        layout="vertical"
        onFinish={saveConfig}
      >
        <Alert
          type={config.autoRefreshEnabled ? "success" : "warning"}
          title={
            config.autoRefreshEnabled
              ? "自动刷新播放记录和收藏"
              : "自动刷新已关闭"
          }
          description="启用后，系统会在每日 01:00 批量刷新播放记录和收藏中的剧集元信息。"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
          <div>
            <p className="text-sm font-medium text-foreground">
              启用自动刷新播放记录和收藏
            </p>
            <p className="text-xs leading-5 text-default-500">
              关闭后定时任务不会主动请求站点接口。
            </p>
          </div>
          <Form.Item name="autoRefreshEnabled" valuePropName="checked" noStyle>
            <Switch
              aria-label="启用自动刷新播放记录和收藏"
              disabled={isLoading}
              onChange={(autoRefreshEnabled) =>
                updateConfigValue("autoRefreshEnabled", autoRefreshEnabled)
              }
            />
          </Form.Item>
        </div>

        <div className="grid gap-5 pt-6 md:grid-cols-2">
          <Form.Item
            label="每次最多处理记录数"
            name="maxRecordsPerRun"
            help="范围 1-1000，用于控制单次任务批量大小。"
          >
            <InputNumber
              min={1}
              max={1000}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                updateConfigValue(
                  "maxRecordsPerRun",
                  normalizeInteger(
                    String(value),
                    defaultConfig.maxRecordsPerRun,
                    1,
                    1000,
                  ),
                )
              }
            />
          </Form.Item>

          <Form.Item
            label="仅刷新最近活跃的记录"
            name="recentActiveDays"
            help="填写最近活跃天数，范围 1-365 天。"
          >
            <InputNumber
              min={1}
              max={365}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                updateConfigValue(
                  "recentActiveDays",
                  normalizeInteger(
                    String(value),
                    defaultConfig.recentActiveDays,
                    1,
                    365,
                  ),
                )
              }
            />
          </Form.Item>

          <Form.Item
            label="搜索接口可拉取最大页数"
            name="maxSearchPages"
            help="限制刷新时向搜索接口翻页拉取的最大页数。"
          >
            <InputNumber
              min={1}
              max={20}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                updateConfigValue(
                  "maxSearchPages",
                  normalizeInteger(
                    String(value),
                    defaultConfig.maxSearchPages,
                    1,
                    20,
                  ),
                )
              }
            />
          </Form.Item>

          <Form.Item
            label="站点接口缓存时间（秒）"
            name="siteCacheSeconds"
            help="范围 0-86400 秒，0 表示不缓存站点接口结果。"
          >
            <InputNumber
              min={0}
              max={86400}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                updateConfigValue(
                  "siteCacheSeconds",
                  normalizeInteger(
                    String(value),
                    defaultConfig.siteCacheSeconds,
                    0,
                    86400,
                  ),
                )
              }
            />
          </Form.Item>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              仅刷新连载中的剧集
            </p>
            <p className="text-xs leading-5 text-default-500">
              开启后完结剧集会跳过，进一步减少出站请求。
            </p>
          </div>
          <Form.Item
            name="onlyRefreshOngoingSeries"
            valuePropName="checked"
            noStyle
          >
            <Switch
              aria-label="仅刷新连载中的剧集"
              disabled={isLoading}
              onChange={(onlyRefreshOngoingSeries) =>
                updateConfigValue(
                  "onlyRefreshOngoingSeries",
                  onlyRefreshOngoingSeries,
                )
              }
            />
          </Form.Item>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
          <Button type="primary" htmlType="submit" loading={isSaving}>
            <SaveOutlined />
            保存配置
          </Button>
        </div>
      </Form>
    </Card>
  );
}
