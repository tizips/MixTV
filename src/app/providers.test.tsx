import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Providers } from "./providers";

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const configProviderMock = vi.fn((props: { children?: ReactNode; theme?: { hashed?: boolean } }) => (
  <div data-testid="config-provider" data-hashed={String(props.theme?.hashed)}>
    {props.children}
  </div>
));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");

  return {
    ...actual,
    App: ({ children }: { children: ReactNode }) => <>{children}</>,
    ConfigProvider: (props: { children?: ReactNode; theme?: { hashed?: boolean } }) => configProviderMock(props),
  };
});

vi.mock("@/modules/stats/ui/page-activity-tracker", () => ({
  PageActivityTracker: () => <div data-testid="page-activity-tracker" />,
}));

describe("Providers", () => {
  it("disables AntD hashed selectors for consistent dev and production output", () => {
    const html = renderToStaticMarkup(
      <Providers>
        <div data-testid="child" />
      </Providers>,
    );

    expect(html).toContain('data-hashed="false"');
    expect(html).toContain("data-testid=\"child\"");
    expect(html).not.toContain("<script");
    expect(configProviderMock).toHaveBeenCalled();
  });
});
