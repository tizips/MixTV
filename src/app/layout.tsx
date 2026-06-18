import type { ReactNode } from "react";
import HolyLoader from "holy-loader";
import Script from "next/script";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/app/providers";
import { AccountGate } from "@/modules/auth";
import { env } from "@/shared/env";

const themeStorageMigrationScript =
  'try{const storageKey="mixtv-theme-mode";let theme=localStorage.getItem(storageKey);if(theme==="auto"){theme="system";localStorage.setItem(storageKey,"system")}const systemTheme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";const resolvedTheme=theme==="light"||theme==="dark"?theme:systemTheme;const root=document.documentElement;root.classList.remove("light","dark");root.classList.add(resolvedTheme);root.style.colorScheme=resolvedTheme}catch{}';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="text-foreground">
        <Script
          id="mixtv-theme-storage-migration"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeStorageMigrationScript }}
        />
        <div className="app-background min-h-screen">
          <HolyLoader
            color="var(--accent)"
            height="2px"
            showSpinner={false}
          />
          <Providers>
            <AccountGate
              accessToken={session?.user?.accessToken}
              fallbackIsAdmin={session?.user?.admin ?? false}
              fallbackUserName={session?.user?.name ?? `${env.NEXT_PUBLIC_SITE_NAME} 用户`}
            >
              <main className="min-h-[calc(100dvh+4rem)] pt-16">{children}</main>
            </AccountGate>
          </Providers>
        </div>
      </body>
    </html>
  );
}
