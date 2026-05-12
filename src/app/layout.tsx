import type { ReactNode } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Providers>
          <SiteHeader />
          <main className="min-h-[calc(100dvh+4rem)] pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
