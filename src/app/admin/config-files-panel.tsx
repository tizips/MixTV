"use client";

import { useState } from "react";
import { Button, Card, Chip, Input, Label, Switch, TextArea } from "@heroui/react";

const defaultSubscriptionUrl = "https://pz.v88.qzz.io?format=2&source=jingjian";

function formatLastUpdated(date: Date | null) {
  if (!date) {
    return "未拉取";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function ConfigFilesPanel() {
  const [subscriptionUrl, setSubscriptionUrl] = useState(defaultSubscriptionUrl);
  const [configText, setConfigText] = useState(`# 订阅配置\nsource=${defaultSubscriptionUrl}\nenabled=true\n`);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pullConfig = () => {
    setConfigText(`## 拉取结果\nsubscription=${subscriptionUrl}\nupdatedBy=manual-pull\n`);
    setLastUpdated(new Date());
  };

  const saveConfig = () => {
    setLastUpdated(new Date());
  };

  return (
    <div>
      <Card className="border border-default-200/70 bg-background/70" variant="secondary">
        <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-folder2-open text-2xl text-cyan-300" />
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
              {autoUpdate ? "自动更新开启" : "自动更新关闭"}
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
              <Button onPress={pullConfig}>拉取配置</Button>
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
            <Switch isSelected={autoUpdate} onChange={setAutoUpdate} aria-label="自动更新">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="config-content">配置内容</Label>
              <Button variant="outline" onPress={saveConfig}>
                保存
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
