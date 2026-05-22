"use client";

import { FolderOpenOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Space,
  Switch,
  Tag,
} from "antd";

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

type SubscriptionFormValues = {
  url?: string;
};

type ConfigContentFormValues = {
  content?: string;
};

function validateConfigContent(value: unknown) {
  const contentValue = typeof value === "string" ? value : "";

  if (!contentValue.trim()) {
    return "请输入配置内容。";
  }

  try {
    JSON.parse(contentValue);
    return null;
  } catch {
    return "配置内容必须是有效 JSON。";
  }
}

function normalizeConfigFilesResponse(payload: unknown): ConfigFilesResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const rawContent =
    raw.content && typeof raw.content === "object"
      ? (raw.content as Record<string, unknown>)
      : {};
  const rawSubscription =
    raw.subscription && typeof raw.subscription === "object"
      ? (raw.subscription as Record<string, unknown>)
      : {};

  return {
    content: {
      content: typeof rawContent.content === "string" ? rawContent.content : "",
      updatedAt:
        typeof rawContent.updatedAt === "string" ||
        rawContent.updatedAt === null
          ? rawContent.updatedAt
          : null,
    },
    subscription: {
      autoUpdate: rawSubscription.autoUpdate === true,
      updatedAt:
        typeof rawSubscription.updatedAt === "string" ||
        rawSubscription.updatedAt === null
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

let configFilesLoadRequest: Promise<ConfigFilesResponse> | null = null;

export function resetConfigFilesPanelState() {
  configFilesLoadRequest = null;
}

async function fetchConfigFiles() {
  const response = await fetch("/api/admin/files");

  if (!response.ok) {
    throw new Error("配置读取失败");
  }

  return normalizeConfigFilesResponse(await response.json());
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

function loadConfigFilesOnce() {
  if (configFilesLoadRequest) {
    return configFilesLoadRequest;
  }

  const request = fetchConfigFiles();
  configFilesLoadRequest = request;

  void request
    .finally(() => {
      if (configFilesLoadRequest === request) {
        configFilesLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

export function ConfigFilesPanel() {
  const { message: msg } = App.useApp();
  const [subscriptionForm] = Form.useForm<SubscriptionFormValues>();
  const [contentForm] = Form.useForm<ConfigContentFormValues>();
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [isSavingAutoUpdate, setIsSavingAutoUpdate] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialConfigFiles() {
      setIsLoading(true);

      try {
        const data = await loadConfigFilesOnce();

        if (!cancelled) {
          subscriptionForm.setFieldsValue({ url: data.subscription.url ?? "" });
          setAutoUpdate(data.subscription.autoUpdate);
          contentForm.setFieldsValue({ content: data.content.content });
          setLastUpdated(
            getLatestUpdatedAt(
              data.subscription.updatedAt,
              data.content.updatedAt,
            ),
          );
          msg.success("配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage =
            error instanceof Error ? error.message : "配置读取失败";
          msg.error(errorMessage);
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
  }, [contentForm, msg, subscriptionForm]);

  const pullConfig = async (values: SubscriptionFormValues) => {
    const subscriptionUrlValue = values.url?.trim() ?? "";

    setIsLoading(true);
    setIsSavingSubscription(true);

    try {
      const response = await fetch("/api/admin/files/subscription/pull", {
        body: JSON.stringify({ url: subscriptionUrlValue }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "订阅配置保存失败"),
        );
      }

      const data = (await response.json()) as SubscriptionResponse;
      subscriptionForm.setFieldsValue({ url: data.url ?? "" });
      setAutoUpdate(data.autoUpdate);
      setLastUpdated(parseUpdatedAt(data.updatedAt));

      const configFiles = await fetchConfigFiles();
      contentForm.setFieldsValue({ content: configFiles.content.content });
      setLastUpdated(
        getLatestUpdatedAt(
          configFiles.subscription.updatedAt,
          configFiles.content.updatedAt,
        ),
      );
      msg.success("配置已拉取并保存");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "配置拉取保存失败";
      msg.error(errorMessage);
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
      const response = await fetch(
        "/api/admin/files/subscription/auto-update",
        {
          body: JSON.stringify({ autoUpdate: nextAutoUpdate }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "自动更新配置保存失败"),
        );
      }

      const data = (await response.json()) as SubscriptionResponse;
      setAutoUpdate(data.autoUpdate);
      setLastUpdated(parseUpdatedAt(data.updatedAt));
      msg.success(data.autoUpdate ? "自动更新已开启" : "自动更新已关闭");
    } catch (error) {
      setAutoUpdate(previousAutoUpdate);
      const errorMessage =
        error instanceof Error ? error.message : "自动更新配置保存失败";
      msg.error(errorMessage);
    } finally {
      setIsSavingAutoUpdate(false);
    }
  };

  const saveConfig = async (values: ConfigContentFormValues) => {
    const contentValue = values.content ?? "";

    setIsSavingContent(true);

    try {
      const response = await fetch("/api/admin/files/subscriptions", {
        body: JSON.stringify({ content: contentValue }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "配置内容保存失败"),
        );
      }

      const data = (await response.json()) as ConfigContentResponse;
      contentForm.setFieldsValue({ content: data.content });
      setLastUpdated(parseUpdatedAt(data.updatedAt));
      msg.success("配置内容已保存");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "配置内容保存失败";
      msg.error(errorMessage);
    } finally {
      setIsSavingContent(false);
    }
  };

  return (
    <div className="relative">
      <Card>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FolderOpenOutlined className="text-2xl text-accent" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    配置文件
                  </h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                这里显示拉取下来的内容，也可以手动修改后保存。
              </p>
            </div>

            <Tag color={autoUpdate ? "success" : "warning"}>
              {isLoading
                ? "加载中"
                : autoUpdate
                  ? "自动更新开启"
                  : "自动更新关闭"}
            </Tag>
          </div>
        </div>

        <Alert
          // styles={{ root: { marginBottom: "10px" } }}
          // classNames={{ root: "mb-10" }}
          title="自动更新"
          description="开启后可自动同步订阅内容。"
          type="info"
          action={
            <Switch
              loading={isSavingAutoUpdate}
              checked={autoUpdate}
              onChange={saveAutoUpdate}
              aria-label="自动更新"
            />
          }
        />

        <Form form={subscriptionForm} layout="vertical" onFinish={pullConfig}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-0 pt-10">
            <p className="text-sm font-medium text-foreground">订阅链接</p>
            <p className="text-sm text-default-500">
              最后更新时间 {formatLastUpdated(lastUpdated)}
            </p>
          </div>

          <Form.Item help="输入配置文件的订阅地址，要求 JSON 格式，且使用 Base58 编码。">
            <Space.Compact block>
              <Form.Item
                label="订阅链接"
                name="url"
                rules={[{ required: true, type: "url" }]}
                noStyle
              >
                <Input placeholder="输入订阅链接" />
              </Form.Item>
              <Button
                loading={isSavingSubscription}
                type="primary"
                htmlType="submit"
              >
                拉取配置
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>

        <Form form={contentForm} layout="vertical" onFinish={saveConfig}>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-10 pb-3">
            <span className="text-sm font-medium text-foreground">
              配置内容
            </span>
            <Button htmlType="submit" loading={isSavingContent}>
              保存
            </Button>
          </div>
          <Form.Item
            name="content"
            help="支持 JSON 格式，用于配置视频源。"
            rules={[
              {
                validator: async (_, value: unknown) => {
                  const errorMessage = validateConfigContent(value);

                  if (errorMessage) {
                    throw new Error(errorMessage);
                  }
                },
              },
            ]}
          >
            <Input.TextArea placeholder="配置内容将显示在这里" rows={11} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
