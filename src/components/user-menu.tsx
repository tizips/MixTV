"use client";

import {
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  HeartOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Divider, Dropdown, Modal, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

type UserMenuProps = {
  userName: string;
  isAdmin?: boolean;
};

type MenuItem = {
  label: string;
  Icon: typeof SettingOutlined;
  trailing?: ReactNode;
  adminOnly?: boolean;
} & (
  | { href: string; onAction?: never }
  | { href?: never; onAction: () => void }
);

function createMenuItems(historyUpdateCount?: number): MenuItem[] {
  return [
    {
      label: "设置",
      href: "/settings",
      Icon: SettingOutlined,
    },
    {
      label: "继续观看",
      href: "/history",
      Icon: PlayCircleOutlined,
      trailing:
        typeof historyUpdateCount === "number" && historyUpdateCount > 0 ? (
          <Tag
            color="red"
            variant="solid"
            className="m-0 rounded-full px-1.5 text-[11px] leading-4"
          >
            {historyUpdateCount}
          </Tag>
        ) : undefined,
    },
    {
      label: "我的收藏",
      href: "/favorites",
      Icon: HeartOutlined,
    },
    {
      label: "管理面板",
      href: "/admin",
      Icon: DashboardOutlined,
      adminOnly: true,
    },
    {
      label: "播放统计",
      href: "/stats",
      Icon: BarChartOutlined,
      adminOnly: true,
    },
    { label: "上映日程", href: "/release-schedule", Icon: CalendarOutlined },
  ];
}

function renderItemContent(
  item: Pick<MenuItem, "Icon" | "label" | "trailing">,
  className = "",
) {
  const Icon = item.Icon;

  return (
    <span className={`flex w-full items-center gap-3 ${className}`.trim()}>
      <Icon className="text-base" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.trailing}
    </span>
  );
}

export function UserMenu({ userName, isAdmin = false }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [historyUpdateCount, setHistoryUpdateCount] = useState<number | null>(
    null,
  );
  const permissionLabel = isAdmin ? "站长" : "普通用户";

  useEffect(() => {
    let cancelled = false;

    async function loadHistoryUpdateCount() {
      try {
        const response = await fetch("/api/history/update-count", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { history?: unknown };
        const nextCount =
          typeof payload.history === "number" &&
          Number.isFinite(payload.history)
            ? Math.max(0, Math.floor(payload.history))
            : 0;

        if (!cancelled) {
          setHistoryUpdateCount(nextCount);
        }
      } catch {
        if (!cancelled) {
          setHistoryUpdateCount(0);
        }
      }
    }

    void loadHistoryUpdateCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const menuItems = createMenuItems(historyUpdateCount ?? undefined);
  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  const items: MenuProps["items"] = visibleMenuItems.map((item) => ({
    key: item.href ?? item.label,
    label: item.href ? (
      <Link href={item.href} prefetch={false} onClick={() => setOpen(false)}>
        {renderItemContent(item)}
      </Link>
    ) : (
      renderItemContent(item)
    ),
  }));

  const handleConfirmLogout = () => {
    setIsLogoutDialogOpen(false);

    void (async () => {
      try {
        await fetch("/api/logout", {
          method: "POST",
        });
      } finally {
        globalThis.location.assign("/login");
      }
    })();
  };

  return (
    <>
      <Dropdown
        open={open}
        trigger={["click"]}
        popupRender={(menu) => (
          <div className="w-60 overflow-hidden rounded-lg bg-(--ant-color-bg-elevated) shadow-lg">
            <div className="px-4 py-4">
              <div className="space-y-2">
                <p className="text-[11px] text-muted">当前用户</p>
                <div className="flex items-center justify-between gap-3">
                  <Typography.Text strong className="text-base text-foreground">
                    {userName}
                  </Typography.Text>
                  <Tag
                    color="cyan"
                    className="m-0 rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {permissionLabel}
                  </Tag>
                </div>
              </div>
            </div>
            <Divider size="small" className="my-0" />
            {menu}
            <Divider size="small" className="my-0" />
            <div className="p-2">
              <Button
                danger
                className="flex h-10 w-full items-center justify-start gap-3"
                type="text"
                onClick={() => {
                  setOpen(false);
                  setIsLogoutDialogOpen(true);
                }}
              >
                <LogoutOutlined className="text-base" />
                <span>登出</span>
              </Button>
            </div>
          </div>
        )}
        menu={{
          items,
          onClick: () => setOpen(false),
          style: { boxShadow: "none" },
        }}
        onOpenChange={setOpen}
      >
        <Button
          aria-label="打开个人中心"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          type="text"
          icon={<UserOutlined className="text-2xl" />}
        />
      </Dropdown>

      <Modal
        centered
        open={isLogoutDialogOpen}
        title="确认登出"
        onCancel={() => setIsLogoutDialogOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsLogoutDialogOpen(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            onClick={handleConfirmLogout}
          >
            确认登出
          </Button>,
        ]}
      >
        <p className="text-sm leading-6 text-default-600">
          确定要退出当前账号吗？
        </p>
      </Modal>
    </>
  );
}
