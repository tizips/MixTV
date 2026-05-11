"use client";

import { type ReactNode, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Switch,
  TextArea,
} from "@heroui/react";

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

const proxyOptions: Array<{ value: ProxyMode; label: string }> = [
  { value: "direct", label: "直连" },
  { value: "zwei", label: "Cors Proxy By Zwei" },
  { value: "official-ali", label: "豆瓣官方精品CDN（阿里云）" },
  { value: "cml-tencent", label: "豆瓣 CDN By CMLiussss （腾讯云）" },
  { value: "cml-ali", label: "豆瓣 CDN By CMLiussss （阿里云）" },
  { value: "custom", label: "自定义" },
];

const imageProxyOptions: Array<{ value: ProxyMode; label: string }> = [
  { value: "direct", label: "直连" },
  { value: "zwei", label: "服务器代理" },
  { value: "official-ali", label: "豆瓣官方精品CDN（阿里云）" },
  { value: "cml-tencent", label: "豆瓣 CDN By CMLiussss（腾讯云）" },
  { value: "cml-ali", label: "豆瓣 CDN By CMLiussss（阿里云）" },
  { value: "custom", label: "自定义" },
];

const defaultValues: SiteConfigFormValues = {
  siteName: "MixTV",
  siteAnnouncement: "欢迎来到 MixTV，请注意站点公告。",
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

function formatProxyLabel(options: Array<{ value: ProxyMode; label: string }>, mode: ProxyMode) {
  return options.find((option) => option.value === mode)?.label ?? "未知";
}

function FieldGroup({
  htmlFor,
  label,
  description,
  children,
}: {
  htmlFor: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description ? <Description>{description}</Description> : null}
    </div>
  );
}

export function SiteConfigPanel({ initialValues }: { initialValues?: Partial<SiteConfigFormValues> }) {
  const [values, setValues] = useState(() => mergeInitialValues(initialValues));
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  const isDataProxyCustom = values.doubanDataProxyMode === "custom";
  const isImageProxyCustom = values.doubanImageProxyMode === "custom";

  const saveConfig = () => {
    setSaveMessage(`已保存到 Mock API：${values.siteName}`);
  };

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-3 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-sliders text-2xl text-emerald-300" />
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-default-500">站点配置</p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">站点配置</h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              这里维护站点基础信息、豆瓣代理和全站开关，当前保存行为通过 Mock API 模拟。
            </p>
          </div>

          <Chip color="primary" variant="flat">
            {saveMessage}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] md:p-8 md:pt-5">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveConfig();
          }}
        >
          <FieldGroup htmlFor="site-name" label="站点名称">
            <Input
              id="site-name"
              value={values.siteName}
              onChange={(event) => setValues((current) => ({ ...current, siteName: event.target.value }))}
              placeholder="输入站点名称"
              variant="secondary"
            />
          </FieldGroup>

          <FieldGroup htmlFor="site-announcement" label="站点公告">
            <TextArea
              id="site-announcement"
              value={values.siteAnnouncement}
              onChange={(event) => setValues((current) => ({ ...current, siteAnnouncement: event.target.value }))}
              placeholder="输入站点公告"
              variant="secondary"
              rows={5}
            />
          </FieldGroup>

          <div className="grid gap-6 lg:grid-cols-2">
            <Select
              className="w-full"
              placeholder="选择代理模式"
              value={values.doubanDataProxyMode}
              onChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value;

                if (nextValue == null) {
                  return;
                }

                setValues((current) => ({
                  ...current,
                  doubanDataProxyMode: String(nextValue) as ProxyMode,
                }));
              }}
              variant="secondary"
            >
              <Label>豆瓣数据代理</Label>
              <Description>用于管理站点抓取豆瓣数据时的代理策略。</Description>
              <Select.Popover>
                <ListBox>
                  {proxyOptions.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              className="w-full"
              placeholder="选择代理模式"
              value={values.doubanImageProxyMode}
              onChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value;

                if (nextValue == null) {
                  return;
                }

                setValues((current) => ({
                  ...current,
                  doubanImageProxyMode: String(nextValue) as ProxyMode,
                }));
              }}
              variant="secondary"
            >
              <Label>豆瓣图片代理</Label>
              <Description>用于管理图片资源的代理策略。</Description>
              <Select.Popover>
                <ListBox>
                  {imageProxyOptions.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {isDataProxyCustom ? (
            <FieldGroup htmlFor="douban-data-proxy-url" label="豆瓣代理地址">
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
                variant="secondary"
              />
            </FieldGroup>
          ) : null}

          {isImageProxyCustom ? (
            <FieldGroup htmlFor="douban-image-proxy-url" label="图片代理地址">
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
                variant="secondary"
              />
            </FieldGroup>
          ) : null}

          <FieldGroup htmlFor="douban-auth" label="豆瓣认证" description="用于模拟保存豆瓣认证字符串，后续可替换为真实配置接口。">
            <TextArea
              id="douban-auth"
              value={values.doubanAuth}
              onChange={(event) => setValues((current) => ({ ...current, doubanAuth: event.target.value }))}
              placeholder="输入豆瓣认证信息"
              variant="secondary"
              rows={5}
            />
          </FieldGroup>

          <Button color="primary" type="submit">
            保存配置
          </Button>
        </form>

        <aside className="space-y-6 rounded-3xl border border-default-200/70 bg-background/50 p-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">全站开关</h3>
            <p className="text-sm leading-6 text-default-500">
              开关状态保持在本地表单中，提交时一并写入 mock 保存结果。
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">启用关键词过滤</p>
                <p className="text-xs text-default-500">过滤低质量搜索结果。</p>
              </div>
              <Switch
                isSelected={values.enableKeywordFilter}
                onChange={() =>
                  setValues((current) => ({
                    ...current,
                    enableKeywordFilter: !current.enableKeywordFilter,
                  }))
                }
                aria-label="启用关键词过滤"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">显示成人内容</p>
                <p className="text-xs text-default-500">适配成人内容展示场景。</p>
              </div>
              <Switch
                isSelected={values.showAdultContent}
                onChange={() =>
                  setValues((current) => ({
                    ...current,
                    showAdultContent: !current.showAdultContent,
                  }))
                }
                aria-label="显示成人内容"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">启用流式搜索</p>
                <p className="text-xs text-default-500">让搜索结果更快呈现给用户。</p>
              </div>
              <Switch
                isSelected={values.enableStreamingSearch}
                onChange={() =>
                  setValues((current) => ({
                    ...current,
                    enableStreamingSearch: !current.enableStreamingSearch,
                  }))
                }
                aria-label="启用流式搜索"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </div>

          <Separator />

          <div className="space-y-3 rounded-2xl border border-default-200/80 bg-background/60 p-4 text-sm text-default-500">
            <p>当前站点：{values.siteName}</p>
            <p>数据代理：{formatProxyLabel(proxyOptions, values.doubanDataProxyMode)}</p>
            <p>图片代理：{formatProxyLabel(imageProxyOptions, values.doubanImageProxyMode)}</p>
          </div>
        </aside>
      </Card.Content>
    </Card>
  );
}
