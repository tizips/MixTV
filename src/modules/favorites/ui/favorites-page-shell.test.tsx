// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPageShell } from "./favorites-page-shell";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt?: string;
    src?: string | { src?: string };
  }) => <span data-alt={alt} data-src={typeof src === "string" ? src : src?.src ?? ""} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, className, href }: { children: ReactNode; className?: string; href: string }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    type,
    variant,
    ...props
  }: {
    [key: string]: unknown;
    children: ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
    variant?: string;
  }) => (
    <button {...props} data-variant={variant} disabled={isDisabled} type={type ?? "button"} onClick={onPress}>
      {children}
    </button>
  ),
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

function renderFavoritesPageShell() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<FavoritesPageShell />);
  });

  return { host, root };
}

function renderFavoritesPageShellInStrictMode() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <FavoritesPageShell />
      </StrictMode>,
    );
  });

  return { host, root };
}

function favoritesResponse(favorites = [
  {
    cover: "https://image.test/poster.jpg",
    douban_id: 0,
    id: "movie-1",
    original_episodes: 12,
    remarks: "更新至12集",
    save_time: 1768471200000,
    search_title: "",
    source: "alpha",
    source_name: "Alpha",
    title: "庆余年 第二季",
    year: "2026",
  },
]) {
  return new Response(JSON.stringify({ favorites }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => favoritesResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("FavoritesPageShell", () => {
  it("loads favorites only once when mounted in Strict Mode", async () => {
    const { host, root } = renderFavoritesPageShellInStrictMode();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/favorites", {
      headers: { Accept: "application/json" },
    });
    expect(host.textContent).toContain("庆余年 第二季");

    act(() => {
      root.unmount();
    });
  });

  it("loads and renders favorites from the favorites API", async () => {
    const { host, root } = renderFavoritesPageShell();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites", {
      headers: { Accept: "application/json" },
    });
    expect(host.textContent).toContain("我的收藏");
    expect(host.textContent).toContain("庆余年 第二季");
    expect(host.textContent).toContain("Alpha");
    expect(host.textContent).toContain("2026");
    expect(host.querySelector('a[href="/play?source=alpha&id=movie-1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="取消收藏 庆余年 第二季"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("removes a favorite and replaces the list from the delete response", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/favorites/alpha/movie-1") {
        return favoritesResponse([]);
      }

      return favoritesResponse();
    });

    const { host, root } = renderFavoritesPageShell();

    await act(async () => {
      await flushPromises();
    });

    const removeButton = host.querySelector('button[aria-label="取消收藏 庆余年 第二季"]') as HTMLButtonElement | null;

    if (!removeButton) {
      throw new Error("Remove favorite button was not rendered");
    }

    await act(async () => {
      removeButton.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", {
      headers: { Accept: "application/json" },
      method: "DELETE",
    });
    expect(host.textContent).not.toContain("庆余年 第二季");
    expect(host.textContent).toContain("还没有收藏内容");

    act(() => {
      root.unmount();
    });
  });
});
