import { cloneElement, createContext, isValidElement, useContext, useEffect, useState } from "react";
import type { CSSProperties, ChangeEvent, ChangeEventHandler, ReactElement, ReactNode } from "react";

type ToastState = {
  error?: (...args: unknown[]) => unknown;
  info?: (...args: unknown[]) => unknown;
  loading?: (...args: unknown[]) => unknown;
  open?: (...args: unknown[]) => unknown;
  success?: (...args: unknown[]) => unknown;
  warning?: (...args: unknown[]) => unknown;
};

type AntdMockOptions = {
  message?: ToastState;
};

type MockFormValues = Record<string, unknown>;

type MockFormRule = {
  validator?: (_: unknown, value: unknown) => Promise<void> | void;
};

type MockFormInstance = {
  getFieldValue: (name: string) => unknown;
  getFieldsValue: () => MockFormValues;
  registerRules: (name: string, rules: MockFormRule[]) => () => void;
  setFieldsValue: (values: MockFormValues) => void;
  subscribe: (listener: () => void) => () => void;
  validateFields: (values: MockFormValues) => Promise<boolean>;
};

function createMockFormInstance(): MockFormInstance {
  const listeners = new Set<() => void>();
  const rulesByName = new Map<string, MockFormRule[]>();
  let values: MockFormValues = {};

  return {
    getFieldValue: (name) => values[name],
    getFieldsValue: () => ({ ...values }),
    registerRules: (name, rules) => {
      rulesByName.set(name, rules);

      return () => {
        rulesByName.delete(name);
      };
    },
    setFieldsValue: (nextValues) => {
      values = { ...values, ...nextValues };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    validateFields: async (nextValues) => {
      try {
        for (const [name, rules] of rulesByName) {
          for (const rule of rules) {
            await rule.validator?.(undefined, nextValues[name]);
          }
        }

        return true;
      } catch {
        return false;
      }
    },
  };
}

const FormContext = createContext<MockFormInstance | null>(null);

export function createAntdMock({ message = {} }: AntdMockOptions = {}) {
  const messageApi = {
    error: message.error ?? (() => undefined),
    info: message.info ?? (() => undefined),
    loading: message.loading ?? (() => undefined),
    open: message.open ?? (() => undefined),
    success: message.success ?? (() => undefined),
    warning: message.warning ?? (() => undefined),
  };

  const App = {
    useApp: () => ({ message: messageApi }),
  };

  const Alert = Object.assign(
    ({
      action,
      children,
      description,
      message: alertMessage,
      title,
    }: {
      action?: ReactNode;
      children?: ReactNode;
      description?: ReactNode;
      message?: ReactNode;
      title?: ReactNode;
    }) => (
      <div>
        {title ?? alertMessage}
        {description}
        {action}
        {children}
      </div>
    ),
    {
      Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Description: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
      Indicator: () => <span />,
      Title: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    },
  );

  const Button = ({
    block,
    children,
    danger,
    disabled,
    form,
    htmlType,
    loading,
    onClick,
    type,
    ...props
  }: {
    children?: ReactNode;
    block?: boolean;
    danger?: boolean;
    disabled?: boolean;
    form?: string;
    htmlType?: "button" | "submit" | "reset";
    loading?: boolean;
    onClick?: () => void;
    type?: "button" | "submit" | "reset" | "default" | "primary" | "link" | "text" | "dashed";
  }) => (
    <button
      {...props}
      data-danger={String(Boolean(danger))}
      disabled={disabled || loading}
      form={form}
      data-block={String(Boolean(block))}
      onClick={onClick}
      type={htmlType ?? (type === "submit" ? "submit" : "button")}
    >
      {children}
    </button>
  );

  const Card = Object.assign(
    ({ children, loading }: { children?: ReactNode; loading?: boolean }) => (
      <section>{loading ? <div data-card-loading="true" /> : children}</section>
    ),
    {
      Grid: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Meta: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
    },
  );

  const Row = ({
    align,
    children,
    className,
    gutter,
    justify,
    ...props
  }: {
    align?: string;
    children?: ReactNode;
    className?: string;
    gutter?: number | [number, number];
    justify?: string;
  }) => (
    <div {...props} className={className} data-align={align} data-gutter={JSON.stringify(gutter)} data-justify={justify}>
      {children}
    </div>
  );

  const Col = ({
    children,
    className,
    md,
    ...props
  }: {
    children?: ReactNode;
    className?: string;
    md?: number;
  }) => (
    <div {...props} className={className} data-md={md}>
      {children}
    </div>
  );

  const Form = Object.assign(
    ({
      children,
      className,
      form,
      layout,
      onFinish,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
      form?: MockFormInstance;
      layout?: string;
      onFinish?: (values: MockFormValues) => void;
    }) => {
      const [fallbackForm] = useState(() => createMockFormInstance());
      const formInstance = form ?? fallbackForm;
      const [, setVersion] = useState(0);

      useEffect(() => formInstance.subscribe(() => setVersion((version) => version + 1)), [formInstance]);

      return (
        <FormContext.Provider value={formInstance}>
          <form
            {...props}
            className={className}
            data-layout={layout}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const values = {
                ...formInstance.getFieldsValue(),
                ...Object.fromEntries(formData.entries()),
              } as MockFormValues;
              void formInstance.validateFields(values).then((isValid) => {
                if (isValid) {
                  onFinish?.(values);
                }
              });
            }}
          >
            {children}
          </form>
        </FormContext.Provider>
      );
    },
    {
      Item: ({
        children,
        label,
        name,
        rules = [],
        valuePropName = "value",
      }: {
        children?: ReactNode;
        label?: ReactNode;
        name?: string;
        rules?: MockFormRule[];
        valuePropName?: "checked" | "value";
      }) => {
        const formInstance = useContext(FormContext);
        const child =
          name && formInstance && isValidElement(children)
            ? cloneElement(children as ReactElement<Record<string, unknown>>, {
                name,
                onChange: (
                  eventOrValue:
                    | unknown[]
                    | boolean
                    | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                    | null
                    | number
                    | string,
                ) => {
                  const nextValue =
                    Array.isArray(eventOrValue) ||
                    eventOrValue === null ||
                    typeof eventOrValue === "number" ||
                    typeof eventOrValue === "string" ||
                    typeof eventOrValue === "boolean"
                      ? eventOrValue
                      : valuePropName === "checked"
                        ? (eventOrValue.currentTarget as HTMLInputElement)
                            .checked
                        : eventOrValue.currentTarget.value;
                  formInstance.setFieldsValue({ [name]: nextValue });
                  const originalOnChange = (children.props as {
                    onChange?: (
                      event:
                        | unknown[]
                        | boolean
                        | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                        | null
                        | number
                        | string,
                    ) => void;
                  }).onChange;
                  originalOnChange?.(eventOrValue);
                },
                [valuePropName]:
                  valuePropName === "checked"
                    ? Boolean(formInstance.getFieldValue(name))
                    : formInstance.getFieldValue(name)?.toString() ?? "",
              })
            : children;

        useEffect(() => {
          if (!name || !formInstance) {
            return undefined;
          }

          return formInstance.registerRules(name, rules);
        }, [formInstance, name, rules]);

        return (
          <div data-form-item-name={name}>
            {label ? <label>{label}</label> : null}
            {child}
            {rules ? null : null}
          </div>
        );
      },
      useForm: () => useState(() => createMockFormInstance()),
      useWatch: (name: string, formInstance: MockFormInstance) => {
        const [value, setValue] = useState(() => formInstance.getFieldValue(name));

        useEffect(
          () =>
            formInstance.subscribe(() => {
              setValue(formInstance.getFieldValue(name));
            }),
          [formInstance, name],
        );

        return value;
      },
    },
  );

  const Checkbox = Object.assign(
    ({
      "aria-label": ariaLabel,
      checked,
      children,
      disabled,
      name,
      onChange,
      value,
      ...props
    }: {
      "aria-label"?: string;
      checked?: boolean;
      children?: ReactNode;
      disabled?: boolean;
      name?: string;
      onChange?: (event: { target: { checked: boolean; value: unknown } }) => void;
      value?: unknown;
    }) => {
      const [currentChecked, setCurrentChecked] = useState(Boolean(checked));

      useEffect(() => {
        setCurrentChecked(Boolean(checked));
      }, [checked]);

      return (
        <label {...props}>
        <input
          aria-label={ariaLabel}
          checked={currentChecked}
          disabled={disabled}
          name={name}
          type="checkbox"
          onChange={(event) => {
            const nextChecked = event.currentTarget.checked;
            setCurrentChecked(nextChecked);
            onChange?.({ target: { checked: nextChecked, value } });
          }}
        />
        {children}
      </label>
      );
    },
    {
      Group: ({
        children,
        onChange,
        value = [],
      }: {
        children?: ReactNode;
        onChange?: (values: string[]) => void;
        value?: string[];
      }) => (
        <div>
          {children}
          <input
            type="hidden"
            value={value.join(",")}
            onChange={(event) => onChange?.(event.currentTarget.value.split(",").filter(Boolean))}
          />
        </div>
      ),
    },
  );

  const Input = Object.assign(
    ({
      accept,
      autoComplete,
      checked,
      className,
      disabled,
      id,
      name,
      onChange,
      onInput,
      placeholder,
      readOnly,
      type,
      value,
      ...props
    }: {
      accept?: string;
      autoComplete?: string;
      checked?: boolean;
      className?: string;
      disabled?: boolean;
      id?: string;
      name?: string;
      onChange?: ChangeEventHandler<HTMLInputElement>;
      onInput?: ChangeEventHandler<HTMLInputElement>;
      placeholder?: string;
      readOnly?: boolean;
      type?: string;
      value?: string;
    }) => {
      const [currentValue, setCurrentValue] = useState(value ?? "");

      useEffect(() => {
        setCurrentValue(value ?? "");
      }, [value]);

      const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.currentTarget.value;
        setCurrentValue(nextValue);
        onChange?.(event);
        onInput?.(event);
      };

      return (
        <input
        {...props}
        accept={accept}
        autoComplete={autoComplete}
        checked={checked}
        className={className}
        disabled={disabled}
        id={id}
        name={name}
        onChange={handleInput}
        onInput={(event) => handleInput(event as unknown as ChangeEvent<HTMLInputElement>)}
        placeholder={placeholder}
        readOnly={readOnly}
        type={type}
        value={currentValue}
      />
      );
    },
    {
      Password: (props: Omit<Parameters<typeof Input>[0], "type">) => <Input {...props} type="password" />,
      TextArea: ({
        className,
        disabled,
        name,
        onChange,
        onInput,
        placeholder,
        value,
        ...props
      }: {
        className?: string;
        disabled?: boolean;
        name?: string;
        onChange?: ChangeEventHandler<HTMLTextAreaElement>;
        onInput?: ChangeEventHandler<HTMLTextAreaElement>;
        placeholder?: string;
        value?: string;
      }) => {
        const [currentValue, setCurrentValue] = useState(value ?? "");

        useEffect(() => {
          setCurrentValue(value ?? "");
        }, [value]);

        const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
          const nextValue = event.currentTarget.value;
          setCurrentValue(nextValue);
          onChange?.(event);
          onInput?.(event);
        };

        return (
          <textarea
            {...props}
            className={className}
            disabled={disabled}
            name={name}
            placeholder={placeholder}
            value={currentValue}
            onChange={handleInput}
            onInput={(event) => handleInput(event as unknown as ChangeEvent<HTMLTextAreaElement>)}
          />
        );
      },
    },
  );

  const InputNumber = ({
    disabled,
    max,
    min,
    onChange,
    style,
    value,
  }: {
    disabled?: boolean;
    max?: number;
    min?: number;
    onChange?: (value: number | null) => void;
    style?: CSSProperties;
    value?: number | null;
  }) => {
    const [currentValue, setCurrentValue] = useState<string>(value?.toString() ?? "");

    useEffect(() => {
      setCurrentValue(value?.toString() ?? "");
    }, [value]);

    return (
      <input
        disabled={disabled}
        max={max}
        min={min}
        style={style}
        type="number"
        value={currentValue}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setCurrentValue(nextValue);
          onChange?.(nextValue === "" ? null : Number(nextValue));
        }}
      />
    );
  };

  const Modal = ({
    children,
    open,
    state,
    title,
  }: {
    children?: ReactNode;
    open?: boolean;
    state?: { isOpen: boolean };
    title?: ReactNode;
  }) =>
    open ?? state?.isOpen ? (
      <div data-dismissible="false" role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null;

  const Select = ({
    "aria-label": ariaLabel,
    disabled,
    name,
    onChange,
    options = [],
    value,
    ...props
  }: {
    "aria-label"?: string;
    disabled?: boolean;
    name?: string;
    onChange?: (value: string) => void;
    options?: Array<{ label: ReactNode; value: string }>;
    value?: string;
  }) => {
    const [currentValue, setCurrentValue] = useState(value ?? "");

    useEffect(() => {
      setCurrentValue(value ?? "");
    }, [value]);

    return (
    <select {...props} aria-label={ariaLabel} disabled={disabled} name={name} value={currentValue} onChange={(event) => {
      const nextValue = event.currentTarget.value;
      setCurrentValue(nextValue);
      onChange?.(nextValue);
    }}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    );
  };

  const Spin = () => <span>loading</span>;

  const Space = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Compact: ({ children }: { block?: boolean; children?: ReactNode }) => (
        <div>{children}</div>
      ),
    },
  );

  const Switch = ({
    "aria-label": ariaLabel,
    checked,
    disabled,
    onChange,
    ...props
  }: {
    "aria-label"?: string;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (checked: boolean) => void;
  }) => {
    const [currentChecked, setCurrentChecked] = useState(Boolean(checked));

    useEffect(() => {
      setCurrentChecked(Boolean(checked));
    }, [checked]);

    return (
    <input
      {...props}
      aria-label={ariaLabel}
      checked={currentChecked}
      disabled={disabled}
      type="checkbox"
      onChange={(event) => {
        const nextChecked = event.currentTarget.checked;
        setCurrentChecked(nextChecked);
        onChange?.(nextChecked);
      }}
    />
    );
  };

  const Tag = ({ children }: { children?: ReactNode }) => <span>{children}</span>;

  const Table = ({
    columns = [],
    dataSource = [],
    onRow,
    rowKey = "key",
  }: {
    columns?: Array<{
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: Record<string, unknown>, index: number) => ReactNode;
      title?: ReactNode;
    }>;
    dataSource?: Array<Record<string, unknown>>;
    onRow?: (record: Record<string, unknown>, index: number) => Record<string, unknown>;
    rowKey?: string | ((record: Record<string, unknown>) => string);
  }) => (
    <table>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={column.key ?? String(column.title ?? index)}>{column.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dataSource.map((record, index) => {
          const key = typeof rowKey === "function" ? rowKey(record) : String(record[rowKey] ?? index);

          const rowProps = onRow?.(record, index) ?? {};

          return (
            <tr key={key} {...rowProps}>
              {columns.map((column, columnIndex) => {
                const value = column.dataIndex ? record[column.dataIndex] : undefined;

                return (
                  <td key={column.key ?? String(column.title ?? columnIndex)}>
                    {column.render ? column.render(value, record, index) : (value as ReactNode)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const Tabs = ({
    activeKey,
    items = [],
    onChange,
  }: {
    activeKey?: string;
    items?: Array<{ children?: ReactNode; key: string; label?: ReactNode }>;
    onChange?: (key: string) => void;
  }) => (
    <div>
      <div>
        {items.map((item) => (
          <button key={item.key} data-active={String(item.key === activeKey)} type="button" onClick={() => onChange?.(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div>
        {items.map((item) => (
          <div key={item.key} data-tab={item.key}>
            {item.children}
          </div>
        ))}
      </div>
    </div>
  );

  const Typography = Object.assign(
    ({ children }: { children?: ReactNode }) => <>{children}</>,
    {
      Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
      Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
    },
  );

  return {
    Alert,
    App,
    Button,
    Card,
    Checkbox,
    Col,
    Form,
    ConfigProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Divider: () => <hr />,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Spin,
    Switch,
    Tag,
    Table,
    Tabs,
    Typography,
    Row,
    message: messageApi,
    theme: {
      darkAlgorithm: {},
      defaultAlgorithm: {},
      useToken: () => ({
        token: {
          colorBorderSecondary: "#f0f0f0",
          colorSplit: "#f0f0f0",
        },
      }),
    },
  };
}
