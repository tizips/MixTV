"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { resolveSafeNextPath } from "../domain/redirect";

type AccountGateProps = {
  accessToken?: string;
  children: ReactNode;
  fallbackIsAdmin?: boolean;
  fallbackUserName: string;
};

type AccountProfile = {
  accessToken: string;
  admin: boolean;
  name: string;
};

function currentSafeNextPath(pathname: string | null) {
  if (typeof window === "undefined") {
    return resolveSafeNextPath(pathname ?? "/");
  }

  return resolveSafeNextPath(
    `${window.location.pathname}${window.location.search}`,
  );
}

function loginRedirectPath(pathname: string | null) {
  const params = new URLSearchParams({
    next: currentSafeNextPath(pathname),
  });

  return `/login?${params.toString()}`;
}

function AccountLoadingPage() {
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[100] min-h-dvh overflow-hidden bg-background text-foreground"
      role="status"
    >
      <style>
        {`
          @keyframes mixtv-account-orbit {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes mixtv-account-counter-orbit {
            0% { transform: rotate(360deg); }
            100% { transform: rotate(0deg); }
          }

          @keyframes mixtv-account-pulse {
            0%, 100% { opacity: 0.44; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1); }
          }

          @keyframes mixtv-account-scan {
            0% { transform: translate3d(-18%, -42%, 0) rotate(-10deg); opacity: 0; }
            18% { opacity: 0.72; }
            70% { opacity: 0.28; }
            100% { transform: translate3d(18%, 42%, 0) rotate(-10deg); opacity: 0; }
          }

          @keyframes mixtv-account-drift {
            0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.52; }
            50% { transform: translate3d(0, -10px, 0); opacity: 0.86; }
          }

          .mixtv-account-loader-orbit {
            animation: mixtv-account-orbit 7.5s cubic-bezier(.42, 0, .2, 1) infinite;
          }

          .mixtv-account-loader-counter {
            animation: mixtv-account-counter-orbit 10s cubic-bezier(.42, 0, .2, 1) infinite;
          }

          .mixtv-account-loader-core {
            animation: mixtv-account-pulse 2.4s ease-in-out infinite;
          }

          .mixtv-account-loader-scan {
            animation: mixtv-account-scan 3.2s ease-in-out infinite;
          }

          .mixtv-account-loader-drift {
            animation: mixtv-account-drift 4.8s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .mixtv-account-loader-orbit,
            .mixtv-account-loader-counter,
            .mixtv-account-loader-core,
            .mixtv-account-loader-scan,
            .mixtv-account-loader-drift {
              animation: none;
            }
          }
        `}
      </style>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,color-mix(in_oklab,var(--background)_92%,var(--accent)_8%),var(--background)_42%,color-mix(in_oklab,var(--surface)_88%,var(--foreground)_12%))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_10%,transparent)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="mixtv-account-loader-drift pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/10 shadow-[0_0_140px_color-mix(in_oklab,var(--accent)_24%,transparent)]" />
      <div
        className="mixtv-account-loader-scan pointer-events-none absolute left-[-8%] top-1/2 h-24 w-[116%] bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--accent)_18%,transparent),color-mix(in_oklab,var(--foreground)_10%,transparent),transparent)] blur-sm"
        data-testid="account-loader-scan"
      />

      <div className="relative flex min-h-dvh items-center justify-center px-6 py-12 text-center">
        <div className="relative flex w-full max-w-sm flex-col items-center gap-8">
          <div
            className="relative h-40 w-40 sm:h-48 sm:w-48"
            data-testid="account-loader-orbit"
          >
            <div className="absolute inset-0 rounded-full border border-foreground/10 bg-surface/45 shadow-2xl backdrop-blur-xl" />
            <div className="mixtv-account-loader-orbit absolute inset-2 rounded-full border border-accent/30 border-t-accent shadow-[0_0_34px_color-mix(in_oklab,var(--accent)_34%,transparent)]" />
            <div className="mixtv-account-loader-counter absolute inset-6 rounded-full border border-foreground/15 border-b-foreground/70" />
            <div className="absolute inset-10 rounded-full border border-accent/20 bg-background/70" />
            <div className="mixtv-account-loader-core absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_42px_var(--accent)]" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.42em] text-accent">
              MixTV
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              正在准备观影空间
            </h1>
            <p className="text-sm leading-6 text-muted">即将进入片库</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountGate({
  accessToken,
  children,
  fallbackIsAdmin = false,
  fallbackUserName,
}: AccountGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const activeAccount = account?.accessToken === accessToken ? account : null;
  const isLoginRoute = pathname === "/login";

  useEffect(
    function verifyAccount() {
      if (isLoginRoute) {
        return;
      }

      if (!accessToken) {
        router.replace(loginRedirectPath(pathname));
        return;
      }

      const currentAccessToken = accessToken;

      if (activeAccount) {
        return;
      }

      let cancelled = false;

      async function loadAccount() {
        try {
          const response = await fetch("/api/account", {
            cache: "no-store",
            headers: {
              authorization: `Bearer ${currentAccessToken}`,
            },
          });

          if (!response.ok) {
            router.replace(loginRedirectPath(pathname));
            return;
          }

          const accountPayload = (await response.json()) as {
            admin?: unknown;
            name?: unknown;
          };

          if (cancelled) {
            return;
          }

          const accountName =
            typeof accountPayload.name === "string" && accountPayload.name
              ? accountPayload.name
              : fallbackUserName;
          const accountAdmin =
            typeof accountPayload.admin === "boolean"
              ? accountPayload.admin
              : fallbackIsAdmin;

          setAccount({
            accessToken: currentAccessToken,
            admin: accountAdmin,
            name: accountName,
          });
        } catch {
          if (!cancelled) {
            router.replace(loginRedirectPath(pathname));
          }
        }
      }

      void loadAccount();

      return () => {
        cancelled = true;
      };
    },
    [
      accessToken,
      activeAccount,
      fallbackIsAdmin,
      fallbackUserName,
      isLoginRoute,
      pathname,
      router,
    ],
  );

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (!activeAccount) {
    return <AccountLoadingPage />;
  }

  return (
    <>
      <SiteHeader
        accessToken={accessToken}
        isAdmin={activeAccount.admin}
        userName={activeAccount.name}
      />
      {children}
    </>
  );
}
