import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StatsPage from "./page";

const authMock = vi.hoisted(() => vi.fn());
const getTrafficOverviewMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/stats", () => ({
  StatsDashboard: ({ overview }: { overview: { checkedAt: string } }) => (
    <div data-testid="stats-dashboard">{overview.checkedAt}</div>
  ),
  getTrafficOverview: getTrafficOverviewMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

describe("StatsPage", () => {
  it("loads a 12 hour timeline window for the dashboard", async () => {
    authMock.mockResolvedValue({
      user: {
        admin: true,
      },
    });
    getTrafficOverviewMock.mockResolvedValue({
      checkedAt: "2026-05-17T00:00:00.000Z",
    });

    const html = renderToStaticMarkup(await StatsPage());

    expect(getTrafficOverviewMock).toHaveBeenCalledWith({
      dayCount: 7,
      timelineMinutes: 720,
    });
    expect(html).toContain('data-testid="stats-dashboard"');
    expect(html).toContain("2026-05-17T00:00:00.000Z");
  });
});
