"use client";

import { SaveOutlined, SlidersOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Tag,
} from "antd";
import { env } from "@/shared/env";

type ProxyMode =
  | "direct"
  | "zwei"
  | "official-ali"
  | "cml-tencent"
  | "cml-ali"
  | "custom";

export type SiteConfigFormValues = {
  siteName: string;
  siteAnnouncement: string;
  doubanDataProxyMode: ProxyMode;
  doubanDataProxyUrl: string;
  doubanImageProxyMode: ProxyMode;
  doubanImageProxyUrl: string;
  doubanAuth: string;
  showAdultContent: boolean;
};

type SiteConfigResponse = SiteConfigFormValues & {
  updatedAt: string | null;
};

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

const proxyOptions: Array<{ value: ProxyMode; label: string }> = [
  { value: "direct", label: "直连（服务器直接请求豆瓣）" },
  { value: "zwei", label: "Cors Proxy By Zwei" },
  { value: "official-ali", label: "豆瓣官方精品CDN（阿里云）" },
  { value: "cml-tencent", label: "豆瓣 CDN By CMLiussss （腾讯云）" },
  { value: "cml-ali", label: "豆瓣 CDN By CMLiussss （阿里云）" },
  { value: "custom", label: "自定义" },
];

const imageProxyOptions: Array<{ value: ProxyMode; label: string }> = [
  { value: "direct", label: "直连（浏览器直接请求豆瓣）" },
  { value: "zwei", label: "服务器代理（由服务器代理请求豆瓣）" },
  { value: "official-ali", label: "豆瓣官方精品CDN（阿里云）" },
  { value: "cml-tencent", label: "豆瓣 CDN By CMLiussss（腾讯云）" },
  { value: "cml-ali", label: "豆瓣 CDN By CMLiussss（阿里云）" },
  { value: "custom", label: "自定义" },
];

const defaultValues: SiteConfigFormValues = {
  siteName: env.NEXT_PUBLIC_SITE_NAME,
  siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
  doubanDataProxyMode: "direct",
  doubanDataProxyUrl: "",
  doubanImageProxyMode: "direct",
  doubanImageProxyUrl: "",
  doubanAuth: "",
  showAdultContent: false,
};

function mergeInitialValues(initialValues?: Partial<SiteConfigFormValues>) {
  return { ...defaultValues, ...initialValues };
}

function isProxyMode(value: unknown): value is ProxyMode {
  return (
    typeof value === "string" &&
    proxyOptions.some((option) => option.value === value)
  );
}

function normalizeSiteConfigResponse(payload: unknown): SiteConfigResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  return {
    ...defaultValues,
    siteName:
      typeof raw.siteName === "string" ? raw.siteName : defaultValues.siteName,
    siteAnnouncement:
      typeof raw.siteAnnouncement === "string"
        ? raw.siteAnnouncement
        : defaultValues.siteAnnouncement,
    doubanDataProxyMode: isProxyMode(raw.doubanDataProxyMode)
      ? raw.doubanDataProxyMode
      : defaultValues.doubanDataProxyMode,
    doubanDataProxyUrl:
      typeof raw.doubanDataProxyUrl === "string"
        ? raw.doubanDataProxyUrl
        : defaultValues.doubanDataProxyUrl,
    doubanImageProxyMode: isProxyMode(raw.doubanImageProxyMode)
      ? raw.doubanImageProxyMode
      : defaultValues.doubanImageProxyMode,
    doubanImageProxyUrl:
      typeof raw.doubanImageProxyUrl === "string"
        ? raw.doubanImageProxyUrl
        : defaultValues.doubanImageProxyUrl,
    doubanAuth:
      typeof raw.doubanAuth === "string"
        ? raw.doubanAuth
        : defaultValues.doubanAuth,
    showAdultContent:
      typeof raw.showAdultContent === "boolean"
        ? raw.showAdultContent
        : defaultValues.showAdultContent,
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

let siteConfigLoadRequest: Promise<SiteConfigResponse> | null = null;

export function resetSiteConfigPanelState() {
  siteConfigLoadRequest = null;
}

async function fetchSiteConfig() {
  const response = await fetch("/api/admin/site-config");

  if (!response.ok) {
    throw new Error("站点配置读取失败");
  }

  return normalizeSiteConfigResponse(await response.json());
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

function loadSiteConfigOnce() {
  if (siteConfigLoadRequest) {
    return siteConfigLoadRequest;
  }

  const request = fetchSiteConfig();
  siteConfigLoadRequest = request;

  void request
    .finally(() => {
      if (siteConfigLoadRequest === request) {
        siteConfigLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

type SiteConfigSwitchKey = "showAdultContent";

function normalizeMainConfigPayload(values: SiteConfigFormValues) {
  return {
    doubanAuth: values.doubanAuth.trim(),
    doubanDataProxyMode: values.doubanDataProxyMode,
    doubanDataProxyUrl: values.doubanDataProxyUrl.trim(),
    doubanImageProxyMode: values.doubanImageProxyMode,
    doubanImageProxyUrl: values.doubanImageProxyUrl.trim(),
  };
}

export function SiteConfigPanel({
  initialValues,
}: {
  initialValues?: Partial<SiteConfigFormValues>;
}) {
  const { message: msg } = App.useApp();
  const [mainForm] = Form.useForm<SiteConfigFormValues>();
  const [initialFormValues] = useState(() => mergeInitialValues(initialValues));
  const [showAdultContent, setShowAdultContent] = useState(
    initialFormValues.showAdultContent,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [savingSwitchKey, setSavingSwitchKey] =
    useState<SiteConfigSwitchKey | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const doubanDataProxyMode =
    Form.useWatch("doubanDataProxyMode", mainForm) ??
    initialFormValues.doubanDataProxyMode;
  const doubanImageProxyMode =
    Form.useWatch("doubanImageProxyMode", mainForm) ??
    initialFormValues.doubanImageProxyMode;
  const isDataProxyCustom = doubanDataProxyMode === "custom";
  const isImageProxyCustom = doubanImageProxyMode === "custom";

  useEffect(() => {
    let cancelled = false;

    async function loadSiteConfig() {
      setIsLoading(true);

      try {
        const data = await loadSiteConfigOnce();

        if (!cancelled) {
          mainForm.setFieldsValue(data);
          setShowAdultContent(data.showAdultContent);
          setLastUpdated(data.updatedAt);
          msg.success("站点配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "站点配置读取失败";
          msg.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSiteConfig();

    return () => {
      cancelled = true;
    };
  }, [mainForm, msg]);

  const saveConfig = async (values: SiteConfigFormValues) => {
    setIsSavingMain(true);

    try {
      const response = await fetch("/api/admin/site-config/main", {
        body: JSON.stringify(normalizeMainConfigPayload(values)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "站点配置保存失败"),
        );
      }

      const data = normalizeSiteConfigResponse(await response.json());
      mainForm.setFieldsValue(data);
      setShowAdultContent(data.showAdultContent);
      setLastUpdated(data.updatedAt);
      msg.success("站点配置已保存");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "站点配置保存失败";
      msg.error(message);
    } finally {
      setIsSavingMain(false);
    }
  };

  const saveSwitch = async (key: SiteConfigSwitchKey, value: boolean) => {
    const previousValue = showAdultContent;

    setShowAdultContent(value);
    setSavingSwitchKey(key);

    try {
      const response = await fetch("/api/admin/site-config/switch", {
        body: JSON.stringify({ key, value }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "开关配置保存失败"),
        );
      }

      const data = normalizeSiteConfigResponse(await response.json());
      mainForm.setFieldsValue(data);
      setShowAdultContent(data.showAdultContent);
      setLastUpdated(data.updatedAt);
      msg.success("开关配置已保存");
    } catch (error) {
      setShowAdultContent(previousValue);
      const message =
        error instanceof Error ? error.message : "开关配置保存失败";
      msg.error(message);
    } finally {
      setSavingSwitchKey(null);
    }
  };

  return (
    <div className="relative">
      <Card loading={isLoading}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SlidersOutlined className="text-2xl text-accent" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    站点配置
                  </h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                这里维护豆瓣代理和认证信息，页面只保留当前需要的配置项，布局也收紧成更直接的单页表单。
              </p>
            </div>

            <Tag color={showAdultContent ? "warning" : "processing"}>
              {isLoading
                ? "加载中"
                : showAdultContent
                  ? "成人内容开启"
                  : "成人内容关闭"}
            </Tag>
          </div>
        </div>

        <Alert
          title="显示成人内容"
          description="开启后站点可展示成人内容，关闭后隐藏相关内容。"
          type={showAdultContent ? "warning" : "info"}
          action={
            <Switch
              checked={showAdultContent}
              aria-label="显示成人内容"
              disabled={isLoading}
              loading={savingSwitchKey === "showAdultContent"}
              onChange={(enabled) =>
                void saveSwitch("showAdultContent", enabled)
              }
            />
          }
        />

        <Form
          form={mainForm}
          initialValues={initialFormValues}
          layout="vertical"
          onFinish={saveConfig}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pt-10">
            <p className="text-sm font-medium text-foreground">豆瓣配置</p>
            <p className="text-sm text-default-500">
              最后更新时间 {formatLastUpdated(lastUpdated)}
            </p>
          </div>

          <Row gutter={[10, 10]}>
            <Col span={24} md={{ span: 12 }}>
              <Form.Item label="豆瓣数据代理" name="doubanDataProxyMode">
                <Select options={proxyOptions} />
              </Form.Item>
            </Col>

            <Col span={24} md={{ span: 12 }}>
              <Form.Item label="豆瓣图片代理" name="doubanImageProxyMode">
                <Select options={imageProxyOptions} />
              </Form.Item>
            </Col>
          </Row>

          <p className="text-sm text-default-500">
            数据代理用于服务端抓取豆瓣数据，图片代理用于页面图片资源加载。
          </p>

          {isDataProxyCustom && (
            <Form.Item
              help="自定义数据代理必须使用 http 或 https 地址。"
              label="豆瓣代理地址"
              name="doubanDataProxyUrl"
              rules={[{ required: true, type: "url" }]}
            >
              <Input placeholder="输入地址" />
            </Form.Item>
          )}

          {isImageProxyCustom && (
            <Form.Item
              help="自定义图片代理必须使用 http 或 https 地址。"
              label="图片代理地址"
              name="doubanImageProxyUrl"
              rules={[{ required: true, type: "url" }]}
            >
              <Input placeholder="输入地址" />
            </Form.Item>
          )}

          <Form.Item
            className="mb-0"
            help="用于保存豆瓣认证字符串。"
            label="豆瓣认证"
            name="doubanAuth"
          >
            <Input.TextArea
              id="douban-auth"
              placeholder="输入豆瓣认证信息"
              rows={5}
            />
          </Form.Item>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-5">
            <Button type="primary" htmlType="submit" loading={isSavingMain}>
              <SaveOutlined />
              保存配置
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
