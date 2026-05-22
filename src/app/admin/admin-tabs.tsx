"use client";

import {
  CloudDownloadOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseFilled,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LayoutOutlined,
  SlidersOutlined,
  SyncOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Button, Card, Divider, Tag } from "antd";
import { CacheManagementPanel } from "./cache-management-panel";
import { ConfigFilesPanel } from "./config-files-panel";
import { CloudSearchPanel } from "./cloud-search-panel";
import { DanmakuPanel } from "./danmaku-panel";
import { DataMigrationPanel } from "./data-migration-panel";
import { HomepageConfigPanel } from "./homepage-config-panel";
import { PerformanceMonitoringPanel } from "./performance-monitoring-panel";
import { SiteConfigPanel } from "./site-config-panel";
import { TimingManagementPanel } from "./timing-management-panel";
import { UserConfigPanel } from "./user-config-panel";
import { VideoSourcePanel } from "./video-source-panel";
import { env } from "@/shared/env";

type AdminTabKey =
  | "config-files"
  | "site-config"
  | "homepage"
  | "user-config"
  | "video-source"
  | "cloud-search"
  | "danmaku"
  | "timing-management"
  | "cache"
  | "migration"
  | "performance";

type AdminTab = {
  key: AdminTabKey;
  label: string;
  Icon: typeof FolderOpenOutlined;
  accent: string;
  description: string;
  cards: Array<{ title: string; value: string }>;
};

const adminTabs: AdminTab[] = [
  {
    key: "config-files",
    label: "配置文件",
    Icon: FolderOpenOutlined,
    accent: "text-accent",
    description: "统一查看和管理站点配置文件、导入导出和备份入口。",
    cards: [
      { title: "当前状态", value: "已连接" },
      { title: "自动更新", value: "可切换" },
      { title: "最后同步", value: "实时预览" },
    ],
  },
  {
    key: "site-config",
    label: "站点配置",
    Icon: SlidersOutlined,
    accent: "text-accent",
    description: "管理全站开关、公告、主题和站点基础信息。",
    cards: [
      { title: "站点名称", value: env.NEXT_PUBLIC_SITE_NAME },
      { title: "公告状态", value: "可编辑" },
      { title: "主题配置", value: "默认主题" },
    ],
  },
  {
    key: "homepage",
    label: "首页模块",
    Icon: LayoutOutlined,
    accent: "text-accent",
    description: "控制首页各模块开关、排序和首页展示策略。",
    cards: [
      { title: "模块开关", value: "8 项配置" },
      { title: "缓存刷新", value: "待接入" },
      { title: "展示预览", value: "可切换" },
    ],
  },
  {
    key: "user-config",
    label: "用户配置",
    Icon: TeamOutlined,
    accent: "text-accent",
    description: "查看用户权限、登录方式、账号策略和管理操作入口。",
    cards: [
      { title: "管理员数量", value: "--" },
      { title: "账号策略", value: "待配置" },
      { title: "权限范围", value: "全站管理" },
    ],
  },
  {
    key: "video-source",
    label: "视频源配置",
    Icon: GlobalOutlined,
    accent: "text-accent",
    description: "集中管理站点内容源、健康状态和同步信息。",
    cards: [
      { title: "源数量", value: "--" },
      { title: "健康状态", value: "待检测" },
      { title: "同步频率", value: "--" },
    ],
  },
  {
    key: "cloud-search",
    label: "网盘搜索",
    Icon: CloudDownloadOutlined,
    accent: "text-accent",
    description: "管理网盘搜索入口、索引结果和搜索策略。",
    cards: [
      { title: "搜索模式", value: "关键词 / 链接" },
      { title: "索引状态", value: "待接入" },
      { title: "命中结果", value: "--" },
    ],
  },
  {
    key: "danmaku",
    label: "弹幕配置",
    Icon: FileTextOutlined,
    accent: "text-accent",
    description: "控制弹幕开关、过滤规则和展示策略。",
    cards: [
      { title: "弹幕开关", value: "默认开启" },
      { title: "过滤规则", value: "待编辑" },
      { title: "来源通道", value: "--" },
    ],
  },
  {
    key: "timing-management",
    label: "定时管理",
    Icon: ClockCircleOutlined,
    accent: "text-accent",
    description: "集中管理定时任务、触发策略和执行记录。",
    cards: [
      { title: "任务数量", value: "--" },
      { title: "运行状态", value: "待接入" },
      { title: "最近执行", value: "--" },
    ],
  },
  {
    key: "cache",
    label: "缓存管理",
    Icon: DatabaseFilled,
    accent: "text-accent",
    description: "查看缓存命中、清理入口和缓存刷新动作。",
    cards: [
      { title: "缓存命中", value: "--" },
      { title: "待清理项", value: "--" },
      { title: "刷新操作", value: "手动 / 定时" },
    ],
  },
  {
    key: "migration",
    label: "数据迁移",
    Icon: SyncOutlined,
    accent: "text-accent",
    description: "承载数据导入、迁移任务、回滚和进度信息。",
    cards: [
      { title: "迁移任务", value: "0" },
      { title: "执行状态", value: "空闲" },
      { title: "回滚能力", value: "预留" },
    ],
  },
  {
    key: "performance",
    label: "性能监控",
    Icon: DashboardOutlined,
    accent: "text-accent",
    description: "展示接口耗时、错误率和系统运行情况。",
    cards: [
      { title: "请求耗时", value: "-- ms" },
      { title: "错误率", value: "--" },
      { title: "系统负载", value: "--" },
    ],
  },
];

function PlaceholderAdminPanel({ tab }: { tab: AdminTab }) {
  const Icon = tab.Icon;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex flex-col items-start gap-4 p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex items-center gap-3">
            <Icon className={`text-2xl ${tab.accent}`} />
            <div>
              <p
                className={`text-sm font-medium uppercase tracking-[0.24em] ${tab.accent}`}
              >
                当前分类
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {tab.label}
              </h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
            {tab.description}
          </p>
        </div>

        <div className="gap-5 p-6 pt-5 md:p-8 md:pt-5">
          <div className="flex flex-wrap gap-3">
            <Button type="primary">进入管理</Button>
            <Button>刷新状态</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {tab.cards.map((card) => (
              <Card key={card.title}>
                <div className="px-4 pb-2 pt-4">
                  <p className="text-sm font-medium text-default-500">
                    {card.title}
                  </p>
                </div>
                <div className="px-4 pt-0">
                  <p className="text-lg font-semibold text-foreground">
                    {card.value}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="px-5 pb-2 pt-5">
            <div>
              <p className="text-sm font-medium text-default-500">模块摘要</p>
              <p className="text-base font-semibold text-foreground">
                {tab.label}
              </p>
            </div>
          </div>
          <Divider />
          <div className="grid gap-3 px-5 py-4">
            <Tag color="processing">HeroUI tab panel</Tag>
            <p className="text-sm leading-6 text-default-600">
              这一区域保留了之前的管理分区，只是把手写 Tailwind chrome
              换成了更稳定的 HeroUI 组件。
            </p>
          </div>
        </Card>

        <Card>
          <div className="px-5 pb-2 pt-5">
            <div>
              <p className="text-sm font-medium text-default-500">操作入口</p>
              <p className="text-base font-semibold text-foreground">
                常用动作
              </p>
            </div>
          </div>
          <Divider />
          <div className="grid gap-3 px-5 py-4">
            <Button type="primary">保存草稿</Button>
            <Button>导出配置</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<AdminTabKey>("config-files");
  const currentTab =
    adminTabs.find((tab) => tab.key === activeTab) ?? adminTabs[0];
  const activePanel =
    currentTab.key === "config-files" ? (
      <ConfigFilesPanel />
    ) : currentTab.key === "site-config" ? (
      <SiteConfigPanel />
    ) : currentTab.key === "homepage" ? (
      <HomepageConfigPanel />
    ) : currentTab.key === "user-config" ? (
      <UserConfigPanel />
    ) : currentTab.key === "video-source" ? (
      <VideoSourcePanel />
    ) : currentTab.key === "cloud-search" ? (
      <CloudSearchPanel />
    ) : currentTab.key === "danmaku" ? (
      <DanmakuPanel />
    ) : currentTab.key === "timing-management" ? (
      <TimingManagementPanel />
    ) : currentTab.key === "cache" ? (
      <CacheManagementPanel />
    ) : currentTab.key === "migration" ? (
      <DataMigrationPanel />
    ) : currentTab.key === "performance" ? (
      <PerformanceMonitoringPanel />
    ) : (
      <PlaceholderAdminPanel tab={currentTab} />
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card>
        <div className="grid gap-2">
          {adminTabs.map((tab) => {
            const Icon = tab.Icon;

            return (
              <Button
                key={tab.key}
                className="shadow-none!"
                block
                type={activeTab === tab.key ? "primary" : "default"}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <Icon className={`text-base ${tab.accent}`} />
                  <span>{tab.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      </Card>

      <div className="min-w-0">{activePanel}</div>
    </div>
  );
}
