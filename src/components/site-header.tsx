"use client";

import {
  HomeFilled,
  SearchOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { env } from "@/shared/env";

const navItems: Array<{
  label: string;
  href: string;
  Icon: typeof HomeFilled;
  iconClass: string;
}> = [
  { label: "首页", href: "/", Icon: HomeFilled, iconClass: "text-muted" },
  {
    label: "搜索",
    href: "/search",
    Icon: SearchOutlined,
    iconClass: "text-muted",
  },
  // Temporarily hidden:
  // {
  //   label: "源浏览器",
  //   href: "/sources",
  //   Icon: AppstoreOutlined,
  //   iconClass: "text-muted",
  // },
  // {
  //   label: "电影",
  //   href: "/movies",
  //   Icon: VideoCameraOutlined,
  //   iconClass: "text-muted",
  // },
  // {
  //   label: "剧集",
  //   href: "/series",
  //   Icon: LaptopOutlined,
  //   iconClass: "text-muted",
  // },
  // {
  //   label: "动漫",
  //   href: "/anime",
  //   Icon: PlaySquareFilled,
  //   iconClass: "text-muted",
  // },
  // {
  //   label: "综艺",
  //   href: "/variety",
  //   Icon: StarFilled,
  //   iconClass: "text-muted",
  // },
];

type SiteHeaderProps = {
  accessToken?: string;
  isAdmin?: boolean;
  userName?: string;
};

export function SiteHeader({
  userName = `${env.NEXT_PUBLIC_SITE_NAME} 用户`,
  isAdmin = false,
}: SiteHeaderProps) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-surface/80 shadow-lg backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full items-center gap-4 px-4 md:px-6 lg:px-12">
        <div className="min-w-0 shrink-0 text-lg font-semibold tracking-tight text-foreground transition">
          {env.NEXT_PUBLIC_SITE_NAME}
        </div>

        <nav aria-label="主导航" className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center justify-center gap-1 whitespace-nowrap">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.Icon;

              return (
                <div
                  key={item.href}
                  className={`border-b-2 pb-0.5 ${active ? "border-accent" : "border-transparent"}`}
                >
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5 md:px-4"
                    aria-current={active ? "page" : undefined}
                    prefetch={false}
                  >
                    <Icon
                      className={`text-base ${active ? "text-accent" : item.iconClass}`}
                    />
                    <span
                      className={active ? "text-accent" : ""}
                    >
                      {item.label}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <UserMenu userName={userName} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
