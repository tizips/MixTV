# Admin Page Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin` placeholder with a tab-based management shell that groups the requested admin categories into a usable dashboard skeleton.

**Architecture:** Keep the route itself thin and move the interactive tab UI into a dedicated client component under `src/app/admin/`. The page will use a local data array to define tab metadata, status cards, and action labels so the layout stays consistent and easy to extend when real admin forms arrive.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Vitest, React DOM server rendering for static UI tests

---

### Task 1: Build the admin tab shell

**Files:**
- Modify: `src/app/admin/page.tsx`
- Add: `src/app/admin/admin-tabs.tsx`

- [ ] **Step 1: Replace the placeholder page with a real admin shell**

```tsx
import { AdminTabs } from "./admin-tabs";

export default function AdminPage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/80">
          MixTV Admin
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          管理面板
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
          这里汇总站点后台能力，当前先提供 tab 骨架，后续可逐步接入真实配置、列表和操作表单。
        </p>
      </div>

      <AdminTabs />
    </section>
  );
}
```

- [ ] **Step 2: Add the interactive tab component with the requested categories**

```tsx
"use client";

import { useState } from "react";

const adminTabs = [
  {
    key: "config-files",
    label: "配置文件",
    description: "统一查看和管理站点配置文件、导入导出和备份入口。",
    accent: "text-cyan-300",
    icon: "bi-folder2-open",
    cards: [
      { title: "配置来源", value: "本地文件 / 远程同步" },
      { title: "最后更新时间", value: "--" },
      { title: "可执行操作", value: "导入 / 导出 / 校验" },
    ],
  },
  {
    key: "site-config",
    label: "站点配置",
    description: "管理全站开关、公告、主题和站点基础信息。",
    accent: "text-emerald-300",
    icon: "bi-sliders",
    cards: [
      { title: "当前状态", value: "已启用" },
      { title: "公告配置", value: "--" },
      { title: "站点主题", value: "默认主题" },
    ],
  },
  {
    key: "homepage",
    label: "首页模块",
    description: "控制首页各模块开关、排序和首页展示策略。",
    accent: "text-violet-300",
    icon: "bi-layout-text-window-reverse",
    cards: [
      { title: "模块开关", value: "9 项配置" },
      { title: "缓存刷新", value: "待接入" },
      { title: "展示预览", value: "--" },
    ],
  },
  {
    key: "user-config",
    label: "用户配置",
    description: "查看用户权限、登录方式、账号策略和管理操作入口。",
    accent: "text-amber-300",
    icon: "bi-people",
    cards: [
      { title: "管理员数量", value: "--" },
      { title: "账号策略", value: "待配置" },
      { title: "权限范围", value: "全站管理" },
    ],
  },
  {
    key: "video-source",
    label: "视频源配置",
    description: "集中管理站点内容源、健康状态和同步信息。",
    accent: "text-sky-300",
    icon: "bi-broadcast",
    cards: [
      { title: "源数量", value: "--" },
      { title: "健康状态", value: "待检测" },
      { title: "同步频率", value: "--" },
    ],
  },
  {
    key: "cloud-search",
    label: "网盘搜索",
    description: "管理网盘搜索入口、索引结果和搜索策略。",
    accent: "text-fuchsia-300",
    icon: "bi-cloud-arrow-down",
    cards: [
      { title: "搜索模式", value: "关键词 / 链接" },
      { title: "索引状态", value: "待接入" },
      { title: "命中结果", value: "--" },
    ],
  },
  {
    key: "danmaku",
    label: "弹幕配置",
    description: "控制弹幕开关、过滤规则和展示策略。",
    accent: "text-rose-300",
    icon: "bi-chat-square-text",
    cards: [
      { title: "弹幕开关", value: "默认开启" },
      { title: "过滤规则", value: "待编辑" },
      { title: "来源通道", value: "--" },
    ],
  },
  {
    key: "cache",
    label: "缓存管理",
    description: "查看缓存命中、清理入口和缓存刷新动作。",
    accent: "text-teal-300",
    icon: "bi-database-fill-gear",
    cards: [
      { title: "缓存命中", value: "--" },
      { title: "待清理项", value: "--" },
      { title: "刷新操作", value: "手动 / 定时" },
    ],
  },
  {
    key: "migration",
    label: "数据迁移",
    description: "承载数据导入、迁移任务、回滚和进度信息。",
    accent: "text-orange-300",
    icon: "bi-arrow-repeat",
    cards: [
      { title: "迁移任务", value: "0" },
      { title: "执行状态", value: "空闲" },
      { title: "回滚能力", value: "预留" },
    ],
  },
  {
    key: "performance",
    label: "性能监控",
    description: "展示接口耗时、错误率和系统运行情况。",
    accent: "text-lime-300",
    icon: "bi-speedometer2",
    cards: [
      { title: "请求耗时", value: "-- ms" },
      { title: "错误率", value: "--" },
      { title: "系统负载", value: "--" },
    ],
  },
] as const;

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState(adminTabs[0].key);
  const currentTab = adminTabs.find((tab) => tab.key === activeTab) ?? adminTabs[0];

  return (
    <div className="mt-8 space-y-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
          {adminTabs.map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-(--homepage-surface) text-(--homepage-text) shadow-lg shadow-black/10"
                    : "text-(--homepage-muted) hover:bg-white/5 hover:text-(--homepage-text)"
                }`}
              >
                <i aria-hidden="true" className={`bi ${tab.icon} text-base ${tab.accent}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-(--homepage-surface) p-6 shadow-2xl shadow-black/10 backdrop-blur-md md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className={`text-sm font-medium uppercase tracking-[0.28em] ${currentTab.accent}`}>
              当前分类
            </p>
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className={`bi ${currentTab.icon} text-2xl ${currentTab.accent}`} />
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {currentTab.label}
              </h2>
            </div>
            <p className="text-sm leading-7 text-slate-300 md:text-base">
              {currentTab.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-(--homepage-accent) px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              进入管理
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-(--homepage-text) transition hover:bg-white/5"
            >
              刷新状态
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {currentTab.cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-white/10 bg-black/10 p-5"
            >
              <p className="text-sm text-(--homepage-muted)">{card.title}</p>
              <p className="mt-3 text-lg font-semibold text-(--homepage-text)">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Task 2: Verify the admin page markup

**Files:**
- Add: `src/app/admin/page.test.tsx`

- [ ] **Step 1: Write a static render test for the page and initial tab content**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "@/app/admin/page";

describe("AdminPage", () => {
  it("renders the tab-based admin shell", async () => {
    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("管理面板");
    expect(html).toContain("配置文件");
    expect(html).toContain("站点配置");
    expect(html).toContain("首页模块");
    expect(html).toContain("性能监控");
    expect(html).toContain("当前分类");
    expect(html).toContain("配置来源");
  });
});
```

- [ ] **Step 2: Run the targeted test and confirm the admin shell renders**

Run: `npm test -- src/app/admin/page.test.tsx`

Expected: PASS, with the page rendering the tab labels and the first tab's summary cards.

- [ ] **Step 3: Run the full verification pass**

Run: `npm test`

Expected: PASS.
