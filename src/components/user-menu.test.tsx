// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { UserMenu } from "./user-menu";

type MockDropdownProps = {
  children: ReactNode;
};

type MockButtonProps = {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  isIconOnly?: boolean;
  onPress?: () => void;
  slot?: string;
  variant?: string;
};

type MockChipProps = {
  children: ReactNode;
  className?: string;
  color?: string;
  size?: string;
  variant?: string;
};

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("@heroui/react", () => {
  function Dropdown({ children }: MockDropdownProps) {
    return <div data-testid="dropdown">{children}</div>;
  }

  function DropdownTrigger({ children }: MockDropdownProps) {
    return <div data-testid="dropdown-trigger">{children}</div>;
  }

  function DropdownPopover({ children }: MockDropdownProps) {
    return <div data-testid="dropdown-popover">{children}</div>;
  }

  function DropdownMenu({ children }: MockDropdownProps) {
    return <ul aria-label="个人中心菜单" role="menu">{children}</ul>;
  }

  function DropdownSection({ children }: MockDropdownProps) {
    return <>{children}</>;
  }

  function DropdownItem({
    children,
    id,
    onAction,
    variant,
  }: {
    children: ReactNode;
    id: string;
    onAction?: () => void;
    variant?: string;
  }) {
    return (
      <li data-id={id} data-variant={variant} role="menuitem" onClick={() => onAction?.()}>
        {children}
      </li>
    );
  }

  Dropdown.Popover = DropdownPopover;
  Dropdown.Trigger = DropdownTrigger;
  Dropdown.Menu = DropdownMenu;
  Dropdown.Section = DropdownSection;
  Dropdown.Item = DropdownItem;

  function Button({ "aria-label": ariaLabel, children, className, isIconOnly, slot, variant }: MockButtonProps) {
    return (
      <button
        aria-label={ariaLabel}
        className={className}
        data-icon-only={isIconOnly ? "true" : undefined}
        data-slot={slot}
        data-variant={variant}
        type="button"
      >
        {children}
      </button>
    );
  }

  function Chip({ children, className, color, size, variant }: MockChipProps) {
    return (
      <span className={className} data-color={color} data-size={size} data-variant={variant}>
        {children}
      </span>
    );
  }

  function Separator() {
    return <li aria-hidden="true" className="border-y border-default-200" role="separator" />;
  }

  function AlertDialogBackdrop({ children }: MockDropdownProps) {
    return <div data-testid="alert-dialog-backdrop">{children}</div>;
  }

  function AlertDialogContainer({ children }: MockDropdownProps) {
    return <div data-testid="alert-dialog-container">{children}</div>;
  }

  function AlertDialogDialog({ children }: MockDropdownProps) {
    return <div data-testid="alert-dialog-dialog">{children}</div>;
  }

  function AlertDialogHeader({ children, className }: { children: ReactNode; className?: string }) {
    return (
      <div className={className} data-testid="alert-dialog-header">
        {children}
      </div>
    );
  }

  function AlertDialogHeading({ children, className }: { children: ReactNode; className?: string }) {
    return <h2 className={className}>{children}</h2>;
  }

  function AlertDialogBody({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
  }

  function AlertDialogFooter({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
  }

  function AlertDialogIcon({ children }: MockDropdownProps) {
    return <div>{children}</div>;
  }

  function AlertDialog({ children }: MockDropdownProps) {
    return <div data-testid="alert-dialog">{children}</div>;
  }

  AlertDialog.Backdrop = AlertDialogBackdrop;
  AlertDialog.Container = AlertDialogContainer;
  AlertDialog.Dialog = AlertDialogDialog;
  AlertDialog.Header = AlertDialogHeader;
  AlertDialog.Heading = AlertDialogHeading;
  AlertDialog.Body = AlertDialogBody;
  AlertDialog.Footer = AlertDialogFooter;
  AlertDialog.Icon = AlertDialogIcon;

  return {
    AlertDialog,
    Button,
    Chip,
    Dropdown,
    Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Separator,
    useOverlayState: () => ({ close: vi.fn(), open: vi.fn() }),
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("UserMenu", () => {
  it("loads the history update count and renders it on the history action", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/history/update-count") {
        return new Response(JSON.stringify({ history: 3 }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<UserMenu userName="橘子" isAdmin />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/history/update-count", { cache: "no-store" });
    expect(host.innerHTML).toContain("继续观看");
    expect(host.innerHTML).toContain(">3<");
    expect(host.innerHTML).not.toContain("更新提醒");
    expect(host.innerHTML).toContain("我的收藏");
    expect(host.innerHTML).not.toContain("版本信息");

    act(() => {
      root.unmount();
    });
  });
});
