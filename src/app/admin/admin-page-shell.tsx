import { Button, Card, Chip, Separator } from "@heroui/react";
import { AdminTabs } from "./admin-tabs";

const overviewCards = [
  {
    title: "站点状态",
    value: "已启用",
    description: "主页、搜索和播放入口都保持在线。",
    tone: "text-emerald-300",
  },
  {
    title: "首页模块",
    value: "9 项配置",
    description: "保留首页模块开关和排序入口。",
    tone: "text-violet-300",
  },
  {
    title: "订阅入口",
    value: "https://pz.v88.qzz.io",
    description: "配置文件面板支持拉取与保存。",
    tone: "text-cyan-300",
  },
] as const;

export function AdminPageShell() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">

      <div className="mt-8">
        <AdminTabs />
      </div>
    </section>
  );
}
