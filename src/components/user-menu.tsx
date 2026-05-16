"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { AlertDialog, Button, Chip, Dropdown, Separator } from "@heroui/react";

type UserMenuProps = {
  userName: string;
  isAdmin?: boolean;
};

type MenuItem = {
  label: string;
  iconClassName: string;
  trailing?: ReactNode;
  adminOnly?: boolean;
} & ({ href: string; onAction?: never } | { href?: never; onAction: () => void });

function createMenuItems(historyUpdateCount?: number): MenuItem[] {
  return [
    { label: "设置", href: "/settings", iconClassName: "bi-gear" },
    {
      label: "继续观看",
      href: "/history",
      iconClassName: "bi-play-circle",
      trailing:
        typeof historyUpdateCount === "number" && historyUpdateCount > 0 ? (
          <Chip className="h-5 shrink-0 px-1.5 text-[11px]" color="danger" size="sm" variant="primary">
            {historyUpdateCount}
          </Chip>
        ) : undefined,
    },
    { label: "我的收藏", href: "/favorites", iconClassName: "bi-heart" },
    { label: "管理面板", href: "/admin", iconClassName: "bi-speedometer2", adminOnly: true },
    { label: "播放统计", href: "/stats", iconClassName: "bi-bar-chart", adminOnly: true },
    { label: "上映日程", href: "/release-schedule", iconClassName: "bi-calendar-event" },
  ];
}

function renderItemContent(item: Pick<MenuItem, "iconClassName" | "label" | "trailing">, className = "") {
  return (
    <span className={`flex w-full items-center gap-3 ${className}`.trim()}>
      <span className={`bi ${item.iconClassName} text-base`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.trailing}
    </span>
  );
}

export function UserMenu({ userName, isAdmin = false }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [historyUpdateCount, setHistoryUpdateCount] = useState<number | null>(null);
  const permissionLabel = isAdmin ? "站长" : "普通用户";

  useEffect(() => {
    let cancelled = false;

    async function loadHistoryUpdateCount() {
      try {
        const response = await fetch("/api/history/update-count", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { history?: unknown };
        const nextCount = typeof payload.history === "number" && Number.isFinite(payload.history)
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
  const logoutItem: MenuItem = {
    label: "登出",
    iconClassName: "bi-box-arrow-right",
    onAction: () => {
      setOpen(false);
      setIsLogoutDialogOpen(true);
    },
  };

  const handleConfirmLogout = () => {
    setIsLogoutDialogOpen(false);
    void signOut({ redirectTo: "/login" });
  };

  return (
    <>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <Dropdown.Trigger>
          <Button aria-label="打开个人中心" className="h-10 w-10 rounded-full p-0" isIconOnly variant="ghost">
            <span className="bi bi-person text-2xl" aria-hidden="true" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Popover className="w-60" placement="bottom end">
          <div className="px-4 py-4">
            <div className="space-y-2">
              <p className="text-[11px] text-default-300">当前用户</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-foreground">{userName}</p>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-foreground">
                  {permissionLabel}
                </span>
              </div>
            </div>
          </div>
          <Dropdown.Menu aria-label="个人中心菜单" selectionMode="none" onAction={() => setOpen(false)}>
            <Separator />
            <Dropdown.Section>
              {menuItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <Dropdown.Item
                    href={item.href}
                    key={item.href ?? item.label}
                    id={item.href ?? item.label}
                    onAction={item.onAction}
                    textValue={item.label}
                  >
                    {renderItemContent(item)}
                  </Dropdown.Item>
                ))}
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              <Dropdown.Item
                id="logout"
                onAction={logoutItem.onAction}
                textValue="登出"
                variant="danger"
              >
                {renderItemContent(logoutItem, "text-danger")}
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <AlertDialog.Backdrop
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
      >
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.Header className="flex flex-col">
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading className="text-center">确认登出</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-center">
              <p className="text-sm leading-6 text-default-600">确定要退出当前账号吗？</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex items-center justify-end gap-2">
              <Button slot="close" variant="tertiary">
                取消
              </Button>
              <Button slot="close" variant="danger" onPress={handleConfirmLogout}>
                确认登出
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
