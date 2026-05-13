"use client";

import { type Key, useState } from "react";
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
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  const isDataProxyCustom = values.doubanDataProxyMode === "custom";
  const isImageProxyCustom = values.doubanImageProxyMode === "custom";

  const saveConfig = () => {
    setSaveMessage(`已保存到 Mock API：${values.siteName}`);
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
              这里维护站点基础信息、豆瓣代理和全站开关，当前保存行为通过 Mock API 模拟。
            </p>
          </div>

          <Chip color="accent" variant="soft">
            {saveMessage}
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
          <TextField fullWidth name="siteName">
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
          </TextField>

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
            <Description>用于模拟保存豆瓣认证字符串，后续可替换为真实配置接口。</Description>
          </TextField>

          <Button variant="primary" fullWidth type="submit">
            保存配置
          </Button>
        </Form>

        <aside className="space-y-6 rounded-3xl border border-default-200/70  bg-background/50 p-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">全站开关</h3>
            <p className="text-sm leading-6 text-default-500">
              开关状态保持在本地表单中，提交时一并写入 mock 保存结果。
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
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

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
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

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-[var(--surface)] px-4 py-3">
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
        </aside>
      </Card.Content>
    </Card>
  );
}
