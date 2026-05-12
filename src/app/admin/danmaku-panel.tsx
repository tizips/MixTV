"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, Switch, TextField } from "@heroui/react";

type DanmakuConfig = {
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
};

function normalizeTimeout(value: string) {
  const timeout = Number(value);

  if (!Number.isFinite(timeout)) {
    return 10;
  }

  return Math.min(120, Math.max(1, Math.round(timeout)));
}

export function DanmakuPanel() {
  const [config, setConfig] = useState<DanmakuConfig>(defaultConfig);
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  const saveConfig = () => {
    setSaveMessage(`已保存 ${config.enabled ? "启用" : "停用"} 状态`);
  };

  const testConnection = () => {
    setSaveMessage(`已测试 ${config.apiUrl || "未填写地址"}`);
  };

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-chat-square-text text-2xl text-rose-300" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">弹幕配置</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              配置弹幕服务开关、接口地址、访问令牌和请求超时时间。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip color={config.enabled ? "success" : "warning"} variant="soft">
              {config.enabled ? "已启用" : "已停用"}
            </Chip>
            <Chip color="accent" variant="soft">
              {saveMessage}
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] md:p-8 md:pt-5">
        <Form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveConfig();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">启用弹幕</p>
              <p className="text-xs leading-5 text-default-500">控制前台播放页是否加载弹幕服务。</p>
            </div>
            <Switch
              aria-label="启用弹幕"
              isSelected={config.enabled}
              onChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <TextField fullWidth name="apiUrl">
            <Label>API地址</Label>
            <Input
              value={config.apiUrl}
              onChange={(event) => setConfig((current) => ({ ...current, apiUrl: event.target.value }))}
              placeholder="例如 https://smonedanmu.vercel.app"
            />
            <Description>弹幕服务的 HTTP 接口根地址。</Description>
          </TextField>

          <TextField fullWidth name="apiToken">
            <Label>API TOKEN</Label>
            <Input
              value={config.apiToken}
              onChange={(event) => setConfig((current) => ({ ...current, apiToken: event.target.value }))}
              placeholder="请输入 API TOKEN"
            />
            <Description>请求弹幕服务时携带的访问令牌。</Description>
          </TextField>

          <TextField fullWidth name="requestTimeoutSeconds">
            <Label>请求超时时间（秒）</Label>
            <Input
              inputMode="numeric"
              min={1}
              max={120}
              type="number"
              value={String(config.requestTimeoutSeconds)}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  requestTimeoutSeconds: normalizeTimeout(event.target.value),
                }))
              }
            />
            <Description>范围 1-120 秒，用于限制单次弹幕接口请求等待时间。</Description>
          </TextField>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" type="button" onPress={testConnection}>
              <i aria-hidden="true" className="bi bi-link-45deg" />
              测试链接
            </Button>
            <Button variant="primary" type="submit">
              <i aria-hidden="true" className="bi bi-save" />
              保存
            </Button>
          </div>
        </Form>

        <aside className="space-y-5 rounded-3xl border border-default-200/70 bg-background/50 p-5">
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>默认弹幕服务</Alert.Title>
              <Alert.Description>
                API地址：https://smonedanmu.vercel.app
                <br />
                Token：smonetv
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <Alert status={config.enabled ? "success" : "warning"}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>当前使用</Alert.Title>
              <Alert.Description>
                API地址：{config.apiUrl || "未填写 API 地址"}
                <br />
                Token：{config.apiToken || "未填写 API TOKEN"}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </aside>
      </Card.Content>
    </Card>
  );
}
