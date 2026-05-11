import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { UserMenu } from "./user-menu";

type MockDropdownProps = {
  children: ReactNode;
};

type MockListBoxProps = {
  "aria-label"?: string;
  children: ReactNode;
};

type MockButtonProps = {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  isIconOnly?: boolean;
  variant?: string;
};

type MockListBoxItemProps = {
  children: ReactNode;
  className?: string;
  id: string;
  render?: (props: { href?: string }) => ReactNode;
  textValue: string;
  variant?: string;
};

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: () => [true, vi.fn()],
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@heroui/react", () => {
  function Dropdown({ children }: MockDropdownProps) {
    return <div data-testid="dropdown">{children}</div>;
  }

  function DropdownPopover({ children }: MockDropdownProps) {
    return <div data-testid="dropdown-popover">{children}</div>;
  }

  Dropdown.Popover = DropdownPopover;

  function Button({ "aria-label": ariaLabel, children, className, isIconOnly, variant }: MockButtonProps) {
    return (
      <button
        aria-label={ariaLabel}
        className={className}
        data-icon-only={isIconOnly ? "true" : undefined}
        data-variant={variant}
        type="button"
      >
        {children}
      </button>
    );
  }

  function ListBox({ "aria-label": ariaLabel, children }: MockListBoxProps) {
    return <ul aria-label={ariaLabel} role="listbox">{children}</ul>;
  }

  function ListBoxItem({ children, className, id, render, textValue, variant }: MockListBoxItemProps) {
    return (
      <li
        aria-selected="false"
        className={className}
        data-id={id}
        data-variant={variant}
        data-text-value={textValue}
        role="option"
      >
        {render ? render({}) : children}
      </li>
    );
  }

  function ListBoxSection({ children }: MockDropdownProps) {
    return <>{children}</>;
  }

  ListBox.Item = ListBoxItem;
  ListBox.Section = ListBoxSection;

  function Label({ children }: { children: ReactNode }) {
    return <span>{children}</span>;
  }

  function Separator() {
    return <li aria-hidden="true" className="border-y border-default-200" role="separator" />;
  }

  return {
    Button,
    Dropdown,
    Label,
    ListBox,
    Separator,
  };
});

describe("UserMenu", () => {
  it("renders the personal center actions in a listbox popover", () => {
    const html = renderToStaticMarkup(<UserMenu userName="橘子" isAdmin />);

    expect(html).toContain('aria-label="打开个人中心"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-icon-only="true"');
    expect(html).toContain("bi-person-circle");
    expect(html).toContain('role="listbox"');
    expect(html).toContain("当前用户");
    expect(html).toContain("橘子");
    expect(html).toContain("站长");
    expect(html).toContain("设置");
    expect(html).toContain("更新提醒");
    expect(html).toContain("继续观看");
    expect(html).toContain("我的收藏");
    expect(html).toContain("管理面板");
    expect(html).toContain("播放统计");
    expect(html).toContain("上映日程");
    expect(html).toContain("bi-gear");
    expect(html).toContain("bi-bell");
    expect(html).toContain("bi-play-circle");
    expect(html).toContain("bi-heart");
    expect(html).toContain("bi-speedometer2");
    expect(html).toContain("bi-bar-chart");
    expect(html).toContain("bi-calendar-event");
    expect(html).toContain("登出");
    expect(html).toContain("bi-box-arrow-right");
    expect(html).toContain("text-danger");
    expect(html).toContain("border-y border-default-200");
    expect(html).toContain("版本信息");
    expect(html).not.toContain("h-px bg-black/20");
    expect(html).not.toContain("h-px bg-black/15");
    expect(html).not.toContain("text-red-400");
    expect(html).not.toContain("rounded-2xl bg-[var(--background)]");
  });
});
