"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip, Description, Form, Input, Label, Separator, TextField } from "@heroui/react";

const backupItems = [
  { icon: "bi-sliders", title: "管理配置" },
  { icon: "bi-people", title: "用户数据" },
  { icon: "bi-clock-history", title: "播放记录" },
  { icon: "bi-bookmark-heart", title: "收藏夹" },
  { icon: "bi-eye", title: "想看" },
];

function getBackupFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `mixtv-backup-${timestamp}.json`;
}

export function DataMigrationPanel() {
  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("等待操作");

  const exportBackup = () => {
    const payload = {
      app: "MixTV",
      version: 1,
      exportedAt: new Date().toISOString(),
      includes: backupItems.map((item) => item.title),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getBackupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("备份文件已生成");
  };

  const importBackup = () => {
    if (!importFile) {
      setStatusMessage("请选择备份文件");
      return;
    }

    setStatusMessage(`已选择 ${importFile.name}，等待接入导入接口`);
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-arrow-repeat text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">数据迁移</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              数据迁移操作请谨慎，确保已备份重要数据
            </p>
          </div>

          <Chip color="accent" variant="soft">
            {statusMessage}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-6 p-6 pt-5 md:p-8 md:pt-5">
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-default-200/80 bg-background/20">
            <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-default-200 bg-background text-accent">
                <i aria-hidden="true" className="bi bi-box-arrow-up text-lg" />
              </span>
              <div className="grid min-w-0 gap-1">
                <p className="text-base font-semibold text-foreground">数据导出</p>
                <p className="text-sm leading-6 text-default-600">输入密码后生成本地备份文件。</p>
              </div>
            </Card.Header>
            <Card.Content className="px-5 pt-0">
              <Form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  exportBackup();
                }}
              >
                <TextField fullWidth isRequired name="exportPassword">
                  <Label>导出密码</Label>
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={exportPassword}
                    onChange={(event) => setExportPassword(event.target.value)}
                  />
                  <Description>用于保护导出的备份内容，请妥善保存。</Description>
                </TextField>

                <Button fullWidth isDisabled={!exportPassword} type="submit" variant="primary">
                  <i aria-hidden="true" className="bi bi-download" />
                  导出备份
                </Button>
              </Form>
            </Card.Content>
          </Card>

          <Card className="border border-default-200/80 bg-background/20">
            <Card.Header className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-5 pb-3 pt-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-default-200 bg-background text-accent">
                <i aria-hidden="true" className="bi bi-box-arrow-in-down text-lg" />
              </span>
              <div className="grid min-w-0 gap-1">
                <p className="text-base font-semibold text-foreground">数据导入</p>
                <p className="text-sm leading-6 text-default-600">⚠️ 将清空现有数据</p>
              </div>
            </Card.Header>
            <Card.Content className="px-5 pt-0">
              <Form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  importBackup();
                }}
              >
                <TextField fullWidth isRequired name="backupFile">
                  <Label>备份文件</Label>
                  <Input
                    accept="application/json,.json"
                    type="file"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                  <Description>{importFile ? importFile.name : "请选择 MixTV 备份文件。"}</Description>
                </TextField>

                <TextField fullWidth isRequired name="importPassword">
                  <Label>导入密码</Label>
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={importPassword}
                    onChange={(event) => setImportPassword(event.target.value)}
                  />
                  <Description>需与导出时设置的密码一致。</Description>
                </TextField>

                <Button fullWidth isDisabled={!importFile || !importPassword} type="submit" variant="primary">
                  <i aria-hidden="true" className="bi bi-upload" />
                  导入备份
                </Button>
              </Form>
            </Card.Content>
          </Card>
        </section>

        <Separator />

        <section className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-default-500">备份内容</p>
            <p className="text-base font-semibold text-foreground">导出和导入会覆盖以下数据范围</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {backupItems.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-warning-soft bg-warning-soft px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-warning-soft-foreground">
                  <i aria-hidden="true" className={`bi ${item.icon}`} />
                </span>
                <span className="text-sm font-medium text-foreground">{item.title}</span>
              </div>
            ))}
          </div>
        </section>

        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>导入前请确认备份来源</Alert.Title>
            <Alert.Description>导入会覆盖对应数据，请使用可信来源的备份文件。</Alert.Description>
          </Alert.Content>
        </Alert>
      </Card.Content>
    </Card>
  );
}
