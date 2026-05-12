"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, Switch, TextField } from "@heroui/react";

type TimingManagementConfig = {
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
};

function normalizeInteger(value: string, fallback: number, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

export function TimingManagementPanel() {
  const [config, setConfig] = useState<TimingManagementConfig>(defaultConfig);
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  const saveConfig = () => {
    setSaveMessage(`已保存，单次最多处理 ${config.maxRecordsPerRun} 条`);
  };

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-clock-history text-2xl text-indigo-300" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">定时管理</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              每天凌晨 1 点自动更新播放记录和收藏的剧集信息。关闭可减少服务器出站流量。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip color={config.autoRefreshEnabled ? "success" : "warning"} variant="soft">
              {config.autoRefreshEnabled ? "自动刷新开启" : "自动刷新关闭"}
            </Chip>
            <Chip color="accent" variant="soft">
              {saveMessage}
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="p-6 pt-5 md:p-8 md:pt-5">
        <Form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveConfig();
          }}
        >
          <Alert status={config.autoRefreshEnabled ? "accent" : "warning"}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{config.autoRefreshEnabled ? "自动刷新播放记录和收藏" : "自动刷新已关闭"}</Alert.Title>
              <Alert.Description>
                启用后，系统会在每日 01:00 批量刷新播放记录和收藏中的剧集元信息。
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">启用自动刷新播放记录和收藏</p>
              <p className="text-xs leading-5 text-default-500">关闭后定时任务不会主动请求站点接口。</p>
            </div>
            <Switch
              aria-label="启用自动刷新播放记录和收藏"
              isSelected={config.autoRefreshEnabled}
              onChange={(autoRefreshEnabled) => setConfig((current) => ({ ...current, autoRefreshEnabled }))}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <TextField fullWidth name="maxRecordsPerRun">
              <Label>每次最多处理记录数</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={1000}
                type="number"
                value={String(config.maxRecordsPerRun)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    maxRecordsPerRun: normalizeInteger(event.target.value, defaultConfig.maxRecordsPerRun, 1, 1000),
                  }))
                }
              />
              <Description>范围 1-1000，用于控制单次任务批量大小。</Description>
            </TextField>

            <TextField fullWidth name="recentActiveDays">
              <Label>仅刷新最近活跃的记录</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={365}
                type="number"
                value={String(config.recentActiveDays)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    recentActiveDays: normalizeInteger(event.target.value, defaultConfig.recentActiveDays, 1, 365),
                  }))
                }
              />
              <Description>填写最近活跃天数，范围 1-365 天。</Description>
            </TextField>

            <TextField fullWidth name="maxSearchPages">
              <Label>搜索接口可拉取最大页数</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={20}
                type="number"
                value={String(config.maxSearchPages)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    maxSearchPages: normalizeInteger(event.target.value, defaultConfig.maxSearchPages, 1, 20),
                  }))
                }
              />
              <Description>限制刷新时向搜索接口翻页拉取的最大页数。</Description>
            </TextField>

            <TextField fullWidth name="siteCacheSeconds">
              <Label>站点接口缓存时间（秒）</Label>
              <Input
                inputMode="numeric"
                min={0}
                max={86400}
                type="number"
                value={String(config.siteCacheSeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    siteCacheSeconds: normalizeInteger(event.target.value, defaultConfig.siteCacheSeconds, 0, 86400),
                  }))
                }
              />
              <Description>范围 0-86400 秒，0 表示不缓存站点接口结果。</Description>
            </TextField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">仅刷新连载中的剧集</p>
              <p className="text-xs leading-5 text-default-500">开启后完结剧集会跳过，进一步减少出站请求。</p>
            </div>
            <Switch
              aria-label="仅刷新连载中的剧集"
              isSelected={config.onlyRefreshOngoingSeries}
              onChange={(onlyRefreshOngoingSeries) =>
                setConfig((current) => ({ ...current, onlyRefreshOngoingSeries }))
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <Button variant="primary" type="submit" fullWidth>
            <i aria-hidden="true" className="bi bi-save" />
            保存配置
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}
