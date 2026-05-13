"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const navItems = [
  { label: "首页", href: "/", icon: "bi-house-door-fill", iconClass: "text-muted" },
  { label: "搜索", href: "/search", icon: "bi-search", iconClass: "text-muted" },
  { label: "源浏览器", href: "/sources", icon: "bi-box-seam", iconClass: "text-muted" },
  { label: "电影", href: "/movies", icon: "bi-film", iconClass: "text-muted" },
  { label: "剧集", href: "/series", icon: "bi-tv-fill", iconClass: "text-muted" },
  { label: "动漫", href: "/anime", icon: "bi-play-btn-fill", iconClass: "text-muted" },
  { label: "综艺", href: "/variety", icon: "bi-stars", iconClass: "text-muted" },
];

type SiteHeaderProps = {
  accessToken?: string;
  isAdmin?: boolean;
  userName?: string;
};

export function SiteHeader({
  accessToken,
  userName = "MixTV 用户",
  isAdmin = false,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [resolvedUserName, setResolvedUserName] = useState(userName);
  const [resolvedIsAdmin, setResolvedIsAdmin] = useState(isAdmin);

  useEffect(() => {
    setResolvedUserName(userName);
    setResolvedIsAdmin(isAdmin);
  }, [isAdmin, userName]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;

    async function hydrateUserProfile() {
      try {
        const response = await fetch("/api/account", {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const account = (await response.json()) as {
          admin?: boolean;
          name?: string;
        };

        if (cancelled) {
          return;
        }

        if (typeof account.name === "string" && account.name) {
          setResolvedUserName(account.name);
        }

        if (typeof account.admin === "boolean") {
          setResolvedIsAdmin(account.admin);
        }
      } catch {
        return;
      }
    }

    void hydrateUserProfile();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[color-mix(in_oklab,var(--surface)_78%,transparent)] shadow-[0_14px_40px_color-mix(in_oklab,var(--foreground)_8%,transparent)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full items-center gap-4 px-4 md:px-6 lg:px-12">
        <div className="min-w-0 shrink-0">
          <Link
            href="/"
            className="truncate text-lg font-semibold tracking-tight text-foreground transition hover:text-accent"
          >
            MixTV
          </Link>
        </div>

        <nav aria-label="主导航" className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center justify-center gap-1 whitespace-nowrap">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <div
                  key={item.href}
                  className={`border-b-2 pb-0.5 ${active ? "border-accent" : "border-transparent"}`}
                >
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-foreground/5 md:px-4"
                    aria-current={active ? "page" : undefined}
                  >
                    <i aria-hidden="true" className={`bi ${item.icon} text-base ${active ? "text-accent" : item.iconClass}`} />
                    <span>{item.label}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <UserMenu userName={resolvedUserName} isAdmin={resolvedIsAdmin} />
        </div>
      </div>
    </header>
  );
}
