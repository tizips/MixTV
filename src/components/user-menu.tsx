"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";
import { Button, Dropdown, Label, ListBox, Separator } from "@heroui/react";

type UserMenuProps = {
  userName: string;
  isAdmin?: boolean;
};

type MenuItem = {
  label: string;
  iconClassName: string;
  adminOnly?: boolean;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

const menuItems: MenuItem[] = [
  { label: "设置", href: "/settings", iconClassName: "bi-gear" },
  { label: "更新提醒", href: "/updates", iconClassName: "bi-bell" },
  { label: "继续观看", href: "/continue-watching", iconClassName: "bi-play-circle" },
  { label: "我的收藏", href: "/favorites", iconClassName: "bi-heart" },
  { label: "管理面板", href: "/admin", iconClassName: "bi-speedometer2", adminOnly: true },
  { label: "播放统计", href: "/stats", iconClassName: "bi-bar-chart" },
  { label: "上映日程", href: "/release-schedule", iconClassName: "bi-calendar-event" },
];

function renderLinkProps(props: unknown): ComponentPropsWithoutRef<"a"> {
  return props as ComponentPropsWithoutRef<"a">;
}

function renderItemContent(item: Pick<MenuItem, "iconClassName" | "label">, className = "") {
  return (
    <span className={`flex items-center gap-3 ${className}`.trim()}>
      <span className={`bi ${item.iconClassName} text-base`} aria-hidden="true" />
      <Label>{item.label}</Label>
    </span>
  );
}

export function UserMenu({ userName, isAdmin = false }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const permissionLabel = isAdmin ? "站长" : "普通用户";
  const logoutItem: MenuItem = {
    label: "登出",
    iconClassName: "bi-box-arrow-right",
    onClick: () => setOpen(false),
  };

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <Button aria-label="打开个人中心" className="h-10 w-10 rounded-full p-0" isIconOnly variant="ghost">
        <span className="bi bi-person-circle text-2xl" aria-hidden="true" />
      </Button>
      <Dropdown.Popover className="w-60" placement="bottom end">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-default-500">当前用户</p>
              <p className="mt-1 text-base font-semibold text-foreground">{userName}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {permissionLabel}
            </span>
          </div>
        </div>
        <ListBox aria-label="个人中心菜单" selectionMode="none" onAction={() => setOpen(false)}>
          <Separator />
          <ListBox.Section>
            {menuItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <ListBox.Item
                  href={item.href}
                  key={item.href ?? item.label}
                  id={item.href ?? item.label}
                  onAction={item.onClick}
                  render={
                    item.href
                      ? (props) => (
                          <Link {...renderLinkProps(props)} href={item.href}>
                            {renderItemContent(item)}
                          </Link>
                        )
                      : undefined
                  }
                  textValue={item.label}
                >
                  {renderItemContent(item)}
                </ListBox.Item>
              ))}
          </ListBox.Section>
          <Separator />
          <ListBox.Section>
            <ListBox.Item
              id="logout"
              onAction={logoutItem.onClick}
              textValue="登出"
              variant="danger"
            >
              {renderItemContent(logoutItem, "text-danger")}
            </ListBox.Item>
          </ListBox.Section>
          <Separator />
          <ListBox.Section>
            <ListBox.Item
              href="/version"
              id="version"
              render={(props) => (
                <Link {...renderLinkProps(props)} href="/version">
                  版本信息
                </Link>
              )}
              textValue="版本信息"
            >
              <Label>版本信息</Label>
            </ListBox.Item>
          </ListBox.Section>
        </ListBox>
      </Dropdown.Popover>
    </Dropdown>
  );
}
