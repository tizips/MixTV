"use client";

import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileProtectOutlined,
  HeartOutlined,
  LoginOutlined,
  SlidersOutlined,
  SyncOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Alert, Button, Card, Col, Divider, Form, Input, Row, Tag } from "antd";
import { env } from "@/shared/env";

const backupItems: Array<{ Icon: typeof SlidersOutlined; title: string }> = [
  { Icon: SlidersOutlined, title: "管理配置" },
  { Icon: TeamOutlined, title: "用户数据" },
  { Icon: ClockCircleOutlined, title: "播放记录" },
  { Icon: HeartOutlined, title: "收藏夹" },
  { Icon: EyeOutlined, title: "想看" },
];

type ExportBackupFormValues = {
  password: string;
};

type ImportBackupFormValues = {
  password: string;
};

function getBackupFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `mixtv-backup-${timestamp}.json`;
}

export function DataMigrationPanel() {
  const [exportForm] = Form.useForm<ExportBackupFormValues>();
  const [importForm] = Form.useForm<ImportBackupFormValues>();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("等待操作");
  const exportPassword = Form.useWatch("password", exportForm);
  const importPassword = Form.useWatch("password", importForm);

  const exportBackup = () => {
    const payload = {
      app: env.NEXT_PUBLIC_SITE_NAME,
      version: 1,
      exportedAt: new Date().toISOString(),
      includes: backupItems.map((item) => item.title),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
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
      <div className="flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SyncOutlined className="text-2xl text-accent" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  数据迁移
                </h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              数据迁移操作请谨慎，导入前确认备份来源并保存当前重要数据。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Tag color="processing">{statusMessage}</Tag>
            <Tag color={importFile ? "success" : "warning"}>
              {importFile ? "已选择备份文件" : "等待备份文件"}
            </Tag>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Alert
          title="导入前请确认备份来源"
          description="导入会覆盖对应数据，请使用可信来源的备份文件。"
          showIcon
          type="warning"
        />

        <Row gutter={[16, 16]} className="mt-5">
          <Col xs={24} lg={12}>
            <section className="overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface p-5">
              <div className="flex items-start gap-3 border-b border-(--ant-color-border) p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <UploadOutlined className="text-lg" />
                </span>
                <div className="min-w-0">
                  <p className="mb-0! text-sm font-medium text-foreground">
                    数据导出
                  </p>
                  <p className="mt-1 text-xs leading-5 text-default-500">
                    输入密码后生成本地备份文件。
                  </p>
                </div>
              </div>

              <Form
                className="p-4"
                form={exportForm}
                layout="vertical"
                onFinish={exportBackup}
                requiredMark={false}
              >
                <Form.Item
                  label="导出密码"
                  name="password"
                  help="用于保护导出的备份内容，请妥善保存。"
                  rules={[{ required: true, message: "请输入导出密码。" }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>

                <Button
                  disabled={!exportPassword}
                  htmlType="submit"
                  type="primary"
                  block
                  icon={<DownloadOutlined />}
                >
                  导出备份
                </Button>
              </Form>
            </section>
          </Col>

          <Col xs={24} lg={12}>
            <section className="overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface p-5">
              <div className="flex items-start gap-3 border-b border-(--ant-color-border) p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <LoginOutlined className="text-lg" />
                </span>
                <div className="min-w-0">
                  <p className="mb-0! text-sm font-medium text-foreground">
                    数据导入
                  </p>
                  <p className="mt-1 text-xs leading-5 text-default-500">
                    导入会覆盖现有数据。
                  </p>
                </div>
              </div>

              <Form
                className="p-4"
                form={importForm}
                layout="vertical"
                onFinish={importBackup}
                requiredMark={false}
              >
                <Form.Item
                  label="备份文件"
                  help={
                    importFile
                      ? importFile.name
                      : `请选择 ${env.NEXT_PUBLIC_SITE_NAME} 备份文件。`
                  }
                >
                  <Input
                    accept="application/json,.json"
                    type="file"
                    onChange={(event) =>
                      setImportFile(event.target.files?.[0] ?? null)
                    }
                  />
                </Form.Item>

                <Form.Item
                  label="导入密码"
                  name="password"
                  help="需与导出时设置的密码一致。"
                  rules={[{ required: true, message: "请输入导入密码。" }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>

                <Button
                  disabled={!importFile || !importPassword}
                  htmlType="submit"
                  type="primary"
                  block
                  icon={<UploadOutlined />}
                >
                  导入备份
                </Button>
              </Form>
            </section>
          </Col>
        </Row>

        <Divider className="my-0" />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileProtectOutlined className="text-xl text-accent" />
            <p className="mb-0! text-sm font-medium text-foreground">
              备份内容
            </p>
            <span className="text-sm text-default-500">
              导出和导入会覆盖以下数据范围
            </span>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface sm:grid-cols-2 xl:grid-cols-5">
            {backupItems.map((item) => {
              const Icon = item.Icon;

              return (
                <div
                  key={item.title}
                  className="flex items-center gap-3 border-b border-(--ant-color-border) px-4 py-3 last:border-b-0 sm:nth-last-[-n+1]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-default-500">
                      <CheckCircleFilled className="text-[10px] text-accent" />
                      已纳入备份
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
}
