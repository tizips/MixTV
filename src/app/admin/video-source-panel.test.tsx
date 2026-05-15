// @vitest-environment happy-dom

import { act, StrictMode, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoSourcePanel } from "./video-source-panel";

const toastState = vi.hoisted(() => ({
  danger: vi.fn(),
  rowRenderCount: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    form,
    isDisabled,
    onPress,
    type,
  }: {
    children?: ReactNode;
    form?: string;
    isDisabled?: boolean;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button disabled={isDisabled} form={form} onClick={onPress} type={type ?? "button"}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children }: { children?: ReactNode }) => <section>{children}</section>, {
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Checkbox: Object.assign(
    ({
      "aria-label": ariaLabel,
      children,
    }: {
      "aria-label"?: string;
      children?: ReactNode;
    }) => (
      <label>
        <input aria-label={ariaLabel} type="checkbox" />
        {children}
      </label>
    ),
    {
      Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Indicator: ({ children }: { children?: ReactNode | ((state: { isIndeterminate: boolean; isSelected: boolean }) => ReactNode) }) => (
        <span>{typeof children === "function" ? children({ isIndeterminate: false, isSelected: false }) : children}</span>
      ),
    },
  ),
  Chip: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Form: ({
    children,
    id,
    onSubmit,
  }: {
    children?: ReactNode;
    id?: string;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
  }) => (
    <form id={id} onSubmit={onSubmit}>
      {children}
    </form>
  ),
  Input: ({
    "aria-label": ariaLabel,
    name,
    onChange,
    value,
  }: {
    "aria-label"?: string;
    name?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    value?: string;
  }) => <input aria-label={ariaLabel} name={name} onChange={onChange} value={value} />,
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  ListBox: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  Modal: Object.assign(({ children, state }: { children?: ReactNode; state: { isOpen: boolean } }) =>
    state.isOpen ? <div role="dialog">{children}</div> : null,
  {
    Backdrop: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Container: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Heading: ({ children }: { children?: ReactNode }) => <h3>{children}</h3>,
  }),
  Select: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Indicator: () => <span />,
    Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    Value: () => <span />,
  }),
  Switch: Object.assign(
    ({
      "aria-label": ariaLabel,
      isDisabled,
      isSelected,
      onChange,
    }: {
      "aria-label"?: string;
      isDisabled?: boolean;
      isSelected?: boolean;
      onChange?: () => void;
    }) => (
      <input
        aria-label={ariaLabel}
        checked={Boolean(isSelected)}
        disabled={isDisabled}
        onChange={() => onChange?.()}
        type="checkbox"
      />
    ),
    {
      Control: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Thumb: () => <span />,
    },
  ),
  Table: Object.assign(({ children }: { children?: ReactNode }) => <table>{children}</table>, {
    Body: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
    Cell: ({ children }: { children?: ReactNode }) => <td>{children}</td>,
    Column: ({ children }: { children?: ReactNode }) => <th>{children}</th>,
    Content: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Header: ({ children }: { children?: ReactNode }) => <thead>{children}</thead>,
    Row: ({ children }: { children?: ReactNode }) => {
      toastState.rowRenderCount();

      return <tr>{children}</tr>;
    },
    ScrollContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
  TextField: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  toast: toastState,
  useOverlayState: () => {
    const [isOpen, setIsOpen] = useState(false);
    return {
      close: () => setIsOpen(false),
      isOpen,
      open: () => setIsOpen(true),
    };
  },
}));

function renderVideoSourcePanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <VideoSourcePanel />
      </StrictMode>,
    );
  });

  return { host, root };
}

function changeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  toastState.danger.mockReset();
  toastState.rowRenderCount.mockReset();
  toastState.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("VideoSourcePanel", () => {
  it("does not rerender table rows when opening source modals", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        sources: Array.from({ length: 80 }, (_, index) => ({
          adult: false,
          apiUrl: `https://source-${index}.test/api`,
          key: `source-${index}`,
          name: `Source ${index}`,
          no: index,
          status: "enabled",
          type: "normal",
          updatedAt: null,
          validity: "warning",
          weight: 10,
        })),
        updatedAt: null,
      }),
      ok: true,
    } as Response);

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastState.rowRenderCount).toHaveBeenCalled();
    toastState.rowRenderCount.mockClear();

    const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "添加");

    await act(async () => {
      addButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("添加视频源");
    expect(toastState.rowRenderCount).not.toHaveBeenCalled();

    toastState.rowRenderCount.mockClear();

    const validityButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("有效性检测"),
    );

    await act(async () => {
      validityButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("有效性检测");
    expect(toastState.rowRenderCount).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("opens a keyword modal and applies streamed validity check results", async () => {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          sources: [
            {
              adult: false,
              apiUrl: "https://alpha.test/api",
              key: "alpha",
              name: "Alpha",
              no: 1,
              status: "enabled",
              type: "normal",
              updatedAt: null,
              validity: "warning",
              weight: 10,
            },
          ],
          updatedAt: null,
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          { headers: { "Content-Type": "text/event-stream" }, status: 200 },
        ),
      );

    const { host, root } = renderVideoSourcePanel();

    await act(async () => {
      await Promise.resolve();
    });

    const checkButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("有效性检测"),
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      checkButton?.click();
      await Promise.resolve();
    });

    const keywordInput = host.querySelector('input[name="validityKeyword"]') as HTMLInputElement | null;
    expect(keywordInput).not.toBeNull();
    expect(keywordInput?.value).toBe("斗罗大陆");

    await act(async () => {
      changeInputValue(keywordInput!, "movie");
      const form = host.querySelector("#validity-check-form") as HTMLFormElement | null;
      form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/video-source/validity-check?keyword=movie", {
      headers: { Accept: "text/event-stream" },
      method: "GET",
    });
    expect(host.textContent).toContain("检测中");

    await act(async () => {
      streamController?.enqueue(
        encoder.encode('event: result\ndata: {"key":"alpha","name":"Alpha","apiUrl":"https://alpha.test/api","validity":"valid"}\n\n'),
      );
      streamController?.close();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("可用");

    act(() => {
      root.unmount();
    });
  });
});
