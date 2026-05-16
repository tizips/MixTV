"use client";

import { type Key, useEffect, useState } from "react";
import { z } from "zod";
import {
  Button,
  Card,
  Chip,
  Description,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
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
  enableKeywordFilter: boolean;
  showAdultContent: boolean;
  enableStreamingSearch: boolean;
};

type SiteConfigResponse = SiteConfigFormValues & {
  updatedAt: string | null;
};

type SiteConfigSwitchKey = "enableKeywordFilter" | "showAdultContent" | "enableStreamingSearch";

const proxyModeValues = [
  "direct",
  "zwei",
  "official-ali",
  "cml-tencent",
  "cml-ali",
  "custom",
] as const;

const siteConfigClientSchema = z
  .object({
    doubanAuth: z.string().trim(),
    doubanDataProxyMode: z.enum(proxyModeValues),
    doubanDataProxyUrl: z.string().trim(),
    doubanImageProxyMode: z.enum(proxyModeValues),
    doubanImageProxyUrl: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.doubanDataProxyMode === "custom" && !isValidHttpUrl(value.doubanDataProxyUrl)) {
      context.addIssue({
        code: "custom",
        message: "请输入有效的豆瓣代理地址。",
        path: ["doubanDataProxyUrl"],
      });
    }

    if (value.doubanImageProxyMode === "custom" && !isValidHttpUrl(value.doubanImageProxyUrl)) {
      context.addIssue({
        code: "custom",
        message: "请输入有效的图片代理地址。",
        path: ["doubanImageProxyUrl"],
      });
    }
  });

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
  enableKeywordFilter: true,
  showAdultContent: false,
  enableStreamingSearch: true,
};

function mergeInitialValues(initialValues?: Partial<SiteConfigFormValues>) {
  return { ...defaultValues, ...initialValues };
}

function isProxyMode(value: unknown): value is ProxyMode {
  return typeof value === "string" && proxyOptions.some((option) => option.value === value);
}

function normalizeSiteConfigResponse(payload: unknown): SiteConfigResponse {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    ...defaultValues,
    siteName: typeof raw.siteName === "string" ? raw.siteName : defaultValues.siteName,
    siteAnnouncement:
      typeof raw.siteAnnouncement === "string" ? raw.siteAnnouncement : defaultValues.siteAnnouncement,
    doubanDataProxyMode: isProxyMode(raw.doubanDataProxyMode)
      ? raw.doubanDataProxyMode
      : defaultValues.doubanDataProxyMode,
    doubanDataProxyUrl:
      typeof raw.doubanDataProxyUrl === "string" ? raw.doubanDataProxyUrl : defaultValues.doubanDataProxyUrl,
    doubanImageProxyMode: isProxyMode(raw.doubanImageProxyMode)
      ? raw.doubanImageProxyMode
      : defaultValues.doubanImageProxyMode,
    doubanImageProxyUrl:
      typeof raw.doubanImageProxyUrl === "string" ? raw.doubanImageProxyUrl : defaultValues.doubanImageProxyUrl,
    doubanAuth: typeof raw.doubanAuth === "string" ? raw.doubanAuth : defaultValues.doubanAuth,
    enableKeywordFilter:
      typeof raw.enableKeywordFilter === "boolean" ? raw.enableKeywordFilter : defaultValues.enableKeywordFilter,
    showAdultContent: typeof raw.showAdultContent === "boolean" ? raw.showAdultContent : defaultValues.showAdultContent,
    enableStreamingSearch:
      typeof raw.enableStreamingSearch === "boolean"
        ? raw.enableStreamingSearch
        : defaultValues.enableStreamingSearch,
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
  };
}

let siteConfigLoadRequest: Promise<SiteConfigResponse> | null = null;

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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "表单校验失败。";
}

function ProxySelect({
  name,
  label,
  description,
  options,
  selectedKey,
  onSelectionChange,
}: {
  name: string;
  label: string;
  description: string;
  options: Array<{ value: ProxyMode; label: string }>;
  selectedKey: ProxyMode;
  onSelectionChange: (mode: ProxyMode) => void;
}) {
  const handleSelectionChange = (key: Key | null) => {
    if (key == null) {
      return;
    }

    onSelectionChange(String(key) as ProxyMode);
  };

  return (
    <Select
      fullWidth
      name={name}
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
      placeholder="选择代理模式"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Description>{description}</Description>
      <Select.Popover>
        <ListBox className="bg-[var(--surface)]">
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function SiteConfigPanel({ initialValues }: { initialValues?: Partial<SiteConfigFormValues> }) {
  const [values, setValues] = useState(() => mergeInitialValues(initialValues));
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [savingSwitchKey, setSavingSwitchKey] = useState<SiteConfigSwitchKey | null>(null);

  const isDataProxyCustom = values.doubanDataProxyMode === "custom";
  const isImageProxyCustom = values.doubanImageProxyMode === "custom";

  useEffect(() => {
    let cancelled = false;

    async function loadSiteConfig() {
      setIsLoading(true);

      try {
        const data = await loadSiteConfigOnce();

        if (!cancelled) {
          setValues(data);
          toast.success("站点配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "站点配置读取失败";
          toast.danger(message);
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
  }, []);

  const saveConfig = async () => {
    const parsedValues = siteConfigClientSchema.safeParse({
      doubanAuth: values.doubanAuth,
      doubanDataProxyMode: values.doubanDataProxyMode,
      doubanDataProxyUrl: values.doubanDataProxyUrl,
      doubanImageProxyMode: values.doubanImageProxyMode,
      doubanImageProxyUrl: values.doubanImageProxyUrl,
    });

    if (!parsedValues.success) {
      toast.danger(getZodErrorMessage(parsedValues.error));
      return;
    }

    setIsSavingMain(true);

    try {
      const response = await fetch("/api/admin/site-config/main", {
        body: JSON.stringify(parsedValues.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "站点配置保存失败"));
      }

      setValues(normalizeSiteConfigResponse(await response.json()));
      toast.success("站点配置已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "站点配置保存失败";
      toast.danger(message);
    } finally {
      setIsSavingMain(false);
    }
  };

  const saveSwitch = async (key: SiteConfigSwitchKey, value: boolean) => {
    const previousValue = values[key];

    setValues((current) => ({ ...current, [key]: value }));
    setSavingSwitchKey(key);

    try {
      const response = await fetch("/api/admin/site-config/switch", {
        body: JSON.stringify({ key, value }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "开关配置保存失败"));
      }

      setValues(normalizeSiteConfigResponse(await response.json()));
      toast.success("开关配置已保存");
    } catch (error) {
      setValues((current) => ({ ...current, [key]: previousValue }));
      const message = error instanceof Error ? error.message : "开关配置保存失败";
      toast.danger(message);
    } finally {
      setSavingSwitchKey(null);
    }
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-3 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-sliders text-2xl text-accent" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">站点配置</h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              这里维护豆瓣代理和全站开关，站点名称和站点公告暂时不开放编辑。
            </p>
          </div>

          <Chip color="accent" variant="soft">
            {isLoading ? "加载中" : "配置管理"}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] md:p-8 md:pt-5">
        <Form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveConfig();
          }}
        >
          {/* <TextField fullWidth name="siteName">
            <Label>站点名称</Label>
            <Input
              id="site-name"
              value={values.siteName}
              onChange={(event) => setValues((current) => ({ ...current, siteName: event.target.value }))}
              placeholder="输入站点名称"
            />
          </TextField>

          <TextField fullWidth name="siteAnnouncement">
            <Label>站点公告</Label>
            <TextArea
              id="site-announcement"
              value={values.siteAnnouncement}
              onChange={(event) => setValues((current) => ({ ...current, siteAnnouncement: event.target.value }))}
              placeholder="输入站点公告"
              rows={5}
            />
          </TextField> */}

          <div className="space-y-6">
            <ProxySelect
              name="doubanDataProxyMode"
              label="豆瓣数据代理"
              description="用于管理站点抓取豆瓣数据时的代理策略。"
              options={proxyOptions}
              selectedKey={values.doubanDataProxyMode}
              onSelectionChange={(mode) =>
                setValues((current) => ({
                  ...current,
                  doubanDataProxyMode: mode,
                }))
              }
            />

            <ProxySelect
              name="doubanImageProxyMode"
              label="豆瓣图片代理"
              description="用于管理图片资源的代理策略。"
              options={imageProxyOptions}
              selectedKey={values.doubanImageProxyMode}
              onSelectionChange={(mode) =>
                setValues((current) => ({
                  ...current,
                  doubanImageProxyMode: mode,
                }))
              }
            />
          </div>

          {isDataProxyCustom ? (
            <TextField fullWidth name="doubanDataProxyUrl">
              <Label>豆瓣代理地址</Label>
              <Input
                id="douban-data-proxy-url"
                value={values.doubanDataProxyUrl}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    doubanDataProxyUrl: event.target.value,
                  }))
                }
                placeholder="输入地址"
              />
            </TextField>
          ) : null}

          {isImageProxyCustom ? (
            <TextField fullWidth name="doubanImageProxyUrl">
              <Label>图片代理地址</Label>
              <Input
                id="douban-image-proxy-url"
                value={values.doubanImageProxyUrl}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    doubanImageProxyUrl: event.target.value,
                  }))
                }
                placeholder="输入地址"
              />
            </TextField>
          ) : null}

          <TextField fullWidth name="doubanAuth">
            <Label>豆瓣认证</Label>
            <TextArea
              id="douban-auth"
              value={values.doubanAuth}
              onChange={(event) => setValues((current) => ({ ...current, doubanAuth: event.target.value }))}
              placeholder="输入豆瓣认证信息"
              rows={5}
            />
            <Description>用于保存豆瓣认证字符串。</Description>
          </TextField>

          <Button variant="primary" fullWidth type="submit" isDisabled={isLoading || isSavingMain}>
            <i aria-hidden="true" className="bi bi-save" />
            {isSavingMain ? "保存中" : "保存配置"}
          </Button>
        </Form>

        <aside className="space-y-6 rounded-3xl border border-default-200/70  bg-background/50 p-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">全站开关</h3>
            <p className="text-sm leading-6 text-default-500">
              开关调整后会立即写入站点配置接口。
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">启用关键词过滤</p>
                <p className="text-xs text-default-500">过滤低质量搜索结果。</p>
              </div>
              <Switch
                isDisabled={isLoading || savingSwitchKey === "enableKeywordFilter"}
                isSelected={values.enableKeywordFilter}
                onChange={(enabled) => void saveSwitch("enableKeywordFilter", enabled)}
                aria-label="启用关键词过滤"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">显示成人内容</p>
                <p className="text-xs text-default-500">适配成人内容展示场景。</p>
              </div>
              <Switch
                isDisabled={isLoading || savingSwitchKey === "showAdultContent"}
                isSelected={values.showAdultContent}
                onChange={(enabled) => void saveSwitch("showAdultContent", enabled)}
                aria-label="显示成人内容"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">启用流式搜索</p>
                <p className="text-xs text-default-500">让搜索结果更快呈现给用户。</p>
              </div>
              <Switch
                isDisabled={isLoading || savingSwitchKey === "enableStreamingSearch"}
                isSelected={values.enableStreamingSearch}
                onChange={(enabled) => void saveSwitch("enableStreamingSearch", enabled)}
                aria-label="启用流式搜索"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </div>
        </aside>
      </Card.Content>
    </Card>
  );
}
