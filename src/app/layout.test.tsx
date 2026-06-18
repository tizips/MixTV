import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout";

const accountGateMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: {
      accessToken: "token-1",
      name: "橘子",
      admin: true,
      id: "orange",
    },
  })),
}));

vi.mock("@/modules/auth", () => ({
  AccountGate: (props: {
    accessToken?: string;
    children: ReactNode;
    fallbackIsAdmin?: boolean;
    fallbackUserName: string;
  }) => {
    accountGateMock(props);

    return (
      <section
        data-access-token={props.accessToken}
        data-fallback-is-admin={String(props.fallbackIsAdmin ?? false)}
        data-fallback-user-name={props.fallbackUserName}
        data-testid="account-gate"
      >
        {props.children}
      </section>
    );
  },
}));

vi.mock("holy-loader", () => ({
  default: (props: {
    boxShadow?: string;
    color?: string;
    height?: string;
    showSpinner?: boolean;
  }) => <div data-testid="holy-loader" data-color={props.color} data-height={props.height} data-show-spinner={String(props.showSpinner)} />,
}));

vi.mock("next/script", () => ({
  default: (props: {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    id?: string;
    strategy?: string;
  }) => (
    <script
      data-strategy={props.strategy}
      dangerouslySetInnerHTML={
        props.dangerouslySetInnerHTML ?? {
          __html: String(props.children ?? ""),
        }
      }
      id={props.id}
    />
  ),
}));

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider" data-storage-key="mixtv-theme-mode">
      {children}
    </div>
  ),
}));

describe("RootLayout", () => {
  it("mounts the account gate and page content", async () => {
    accountGateMock.mockClear();

    const html = renderToStaticMarkup(
      await RootLayout({
        children: <div data-testid="page-child">child</div>,
      }),
    );

    expect(html).toContain('data-storage-key="mixtv-theme-mode"');
    expect(html).toContain('class="text-foreground"');
    expect(html).toContain('class="min-h-[calc(100dvh+4rem)] pt-16"');
    expect(html).toContain("holy-loader");
    expect(html).toContain('data-color="var(--accent)"');
    expect(html).toContain('data-height="2px"');
    expect(html).toContain('data-show-spinner="false"');
    expect(html).toContain("account-gate");
    expect(html).toContain('data-access-token="token-1"');
    expect(html).toContain('data-fallback-is-admin="true"');
    expect(html).toContain('data-fallback-user-name="橘子"');
    expect(html).toContain("page-child");
    expect(html).toContain('id="mixtv-theme-storage-migration"');
    expect(html).toContain('data-strategy="beforeInteractive"');
    expect(html).toContain('if(theme==="auto")');
    expect(html).toContain('localStorage.setItem(storageKey,"system")');
    expect(html).toContain('document.documentElement');
    expect(html).toContain('classList.add(resolvedTheme)');
    expect(html).toContain('style.colorScheme=resolvedTheme');

    const gateProps = accountGateMock.mock.calls[0]?.[0];

    expect(gateProps).toEqual(
      expect.objectContaining({
        accessToken: "token-1",
        fallbackIsAdmin: true,
        fallbackUserName: "橘子",
      }),
    );
  });
});
