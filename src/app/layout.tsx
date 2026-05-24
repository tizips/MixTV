import type { ReactNode } from "react";
import HolyLoader from "holy-loader";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { env } from "@/shared/env";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="text-foreground">
        <div className="app-background min-h-screen">
          <HolyLoader
            color="var(--accent)"
            height="2px"
            showSpinner={false}
          />
          <Providers>
            <SiteHeader
              accessToken={session?.user?.accessToken}
              isAdmin={session?.user?.admin ?? false}
              userName={session?.user?.name ?? `${env.NEXT_PUBLIC_SITE_NAME} 用户`}
            />
            <main className="min-h-[calc(100dvh+4rem)] pt-16">{children}</main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
