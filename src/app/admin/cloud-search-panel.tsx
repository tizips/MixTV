"use client";

import { useState } from "react";
import type { Selection } from "@react-types/shared";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, ListBox, Switch, TextField } from "@heroui/react";

type CloudDriveType = "baidu" | "ali" | "quark";

type CloudSearchConfig = {
  enabled: boolean;
  panSouUrl: string;
  requestTimeoutSeconds: number;
  supportedDriveTypes: CloudDriveType[];
};

const driveTypeOptions: Array<{ value: CloudDriveType; label: string; icon: string }> = [
  { value: "baidu", label: "百度", icon: "bi-cloud" },
  { value: "ali", label: "阿里", icon: "bi-hdd-network" },
  { value: "quark", label: "夸克", icon: "bi-lightning-charge" },
];

const defaultConfig: CloudSearchConfig = {
  enabled: true,
  panSouUrl: "http://localhost:8888",
  requestTimeoutSeconds: 10,
  supportedDriveTypes: ["baidu", "ali", "quark"],
};

function normalizeTimeout(value: string) {
  const timeout = Number(value);

  if (!Number.isFinite(timeout)) {
    return 10;
  }

  return Math.min(120, Math.max(1, Math.round(timeout)));
}

export function CloudSearchPanel() {
  const [config, setConfig] = useState<CloudSearchConfig>(defaultConfig);
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  const selectedDriveTypeKeys = new Set(config.supportedDriveTypes);
  const handleDriveTypeSelectionChange = (selection: Selection) => {
    const selectedTypes =
      selection === "all" ? driveTypeOptions.map((option) => option.value) : Array.from(selection).map(String);

    setConfig((current) => ({
      ...current,
      supportedDriveTypes: selectedTypes.filter((type): type is CloudDriveType =>
        driveTypeOptions.some((option) => option.value === type),
      ),
    }));
  };

  const saveConfig = () => {
    setSaveMessage(`已保存 ${config.supportedDriveTypes.length} 个网盘类型`);
  };

  return (
    <Card className="border border-default-200/70 bg-background/70" variant="secondary">
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-cloud-arrow-down text-2xl text-fuchsia-300" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">网盘搜索</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              配置 PanSou 服务地址、请求超时和站点允许展示的网盘搜索类型。
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
          <Alert status={config.enabled ? "accent" : "warning"}>
            <Alert.Indicator />
            <Alert.Content className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
              <Alert.Title>{config.enabled ? "网盘搜索功能已启动" : "网盘搜索功能未启动"}</Alert.Title>
              <Alert.Description>
                集成开源项目 PanSou 提供网盘资源搜索功能。
              </Alert.Description>
              </span>
              <a
                className="inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-default-300 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100"
                href="https://github.com/fish2018/pansou"
                rel="noreferrer"
                target="_blank"
              >
                <i aria-hidden="true" className="bi bi-github" />
                查看项目
              </a>
            </Alert.Content>
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">启动网盘搜索</p>
              <p className="text-xs leading-5 text-default-500">控制前台是否展示并请求网盘搜索能力。</p>
            </div>
            <Switch
              aria-label="启动网盘搜索"
              isSelected={config.enabled}
              onChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <TextField fullWidth name="panSouUrl">
            <Label>PanSou 服务地址</Label>
            <Input
              value={config.panSouUrl}
              onChange={(event) => setConfig((current) => ({ ...current, panSouUrl: event.target.value }))}
              placeholder="例如 http://localhost:8888"
            />
            <Description>填写 PanSou HTTP 服务根地址，保存后由后端搜索接口读取。</Description>
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
            <Description>范围 1-120 秒，用于限制单次 PanSou 请求等待时间。</Description>
          </TextField>

          <Button variant="primary" type="submit" fullWidth>
            <i aria-hidden="true" className="bi bi-save" />
            保存配置
          </Button>
        </Form>

        <aside className="space-y-5 rounded-3xl border border-default-200/70 bg-background/50 p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">支持的网盘类型</h3>
            <p className="text-sm leading-6 text-default-500">选择前台搜索结果中允许出现的网盘类型。</p>
          </div>

          <ListBox
            aria-label="支持的网盘类型"
            className="gap-2 rounded-2xl border border-default-200/80 bg-background/60 p-2"
            selectedKeys={selectedDriveTypeKeys}
            selectionMode="multiple"
            onSelectionChange={handleDriveTypeSelectionChange}
          >
            {driveTypeOptions.map((option) => (
              <ListBox.Item
                key={option.value}
                id={option.value}
                textValue={option.label}
                className="rounded-xl px-3 py-3"
              >
                <div className="flex min-h-8 items-center justify-between gap-3">
                  <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <i aria-hidden="true" className={`bi ${option.icon} text-fuchsia-300`} />
                    {option.label}
                  </span>
                  <ListBox.ItemIndicator>
                    {({ isSelected }) => (isSelected ? <i aria-hidden="true" className="bi bi-check-lg" /> : null)}
                  </ListBox.ItemIndicator>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </aside>
      </Card.Content>
    </Card>
  );
}
