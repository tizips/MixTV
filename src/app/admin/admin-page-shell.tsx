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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card className="border border-default-200/70 bg-background/70 shadow-sm" variant="secondary">
          <Card.Content className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Chip color="primary" variant="flat">
                MixTV Admin
              </Chip>
              <span className="text-sm font-medium uppercase tracking-[0.28em] text-default-500">
                站点运营仪表盘
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                管理面板
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                这里汇总站点后台能力，先提供 HeroUI 驱动的 tab 结构、配置表单和状态卡片，后续再接入真实 API。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button color="primary" variant="solid">
                进入配置
              </Button>
              <Button variant="bordered">刷新状态</Button>
            </div>
          </Card.Content>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {overviewCards.map((card) => (
            <Card key={card.title} className="border border-default-200/70 bg-background/70" variant="secondary">
              <Card.Header className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
                <div>
                  <p className="text-sm font-medium text-default-500">{card.title}</p>
                  <p className={`mt-2 text-2xl font-semibold tracking-tight ${card.tone}`}>{card.value}</p>
                </div>
              </Card.Header>
              <Separator />
              <Card.Content className="px-5 py-4">
                <p className="text-sm leading-6 text-default-600">{card.description}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <AdminTabs />
      </div>
    </section>
  );
}
