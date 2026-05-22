"use client";

import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  CloudFilled,
  CloudOutlined,
  CloudServerOutlined,
  CloudSyncOutlined,
  CompassOutlined,
  DownloadOutlined,
  GithubOutlined,
  InboxOutlined,
  LinkOutlined,
  MobileOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Tag,
} from "antd";

type CloudSearchDriveType = {
  key: string;
  label: string;
};

type CloudSearchConfig = {
  enabled: boolean;
  panSouUrl: string;
  requestTimeoutSeconds: number;
  supportedDriveTypes: string[];
  updatedAt: string | null;
};

type CloudSearchFormValues = {
  enabled: boolean;
  panSouUrl: string;
  requestTimeoutSeconds: number;
  supportedDriveTypes: string[];
};

const defaultDriveTypeIcons: Record<string, typeof CloudOutlined> = {
  "115": InboxOutlined,
  "123": CloudOutlined,
  aliyun: CloudServerOutlined,
  baidu: CloudFilled,
  ed2k: LinkOutlined,
  magnet: WarningOutlined,
  mobile: MobileOutlined,
  pikpak: AppstoreOutlined,
  quark: ThunderboltOutlined,
  tianyi: CloudSyncOutlined,
  uc: CompassOutlined,
  xunlei: DownloadOutlined,
};

const defaultConfig: CloudSearchConfig = {
  enabled: true,
  panSouUrl: "https://so.252035.xyz",
  requestTimeoutSeconds: 30,
  supportedDriveTypes: [],
  updatedAt: null,
};

function normalizeTimeout(value: string) {
  const timeout = Number(value);

  if (!Number.isFinite(timeout)) {
    return 30;
  }

  return Math.min(120, Math.max(1, Math.round(timeout)));
}

async function readApiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as unknown;

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const message = (payload as Record<string, unknown>).message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function normalizeConfig(payload: unknown): CloudSearchConfig {
  const raw =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    enabled: raw.enabled === false ? false : true,
    panSouUrl:
      typeof raw.panSouUrl === "string"
        ? raw.panSouUrl
        : defaultConfig.panSouUrl,
    requestTimeoutSeconds:
      typeof raw.requestTimeoutSeconds === "number"
        ? normalizeTimeout(String(raw.requestTimeoutSeconds))
        : defaultConfig.requestTimeoutSeconds,
    supportedDriveTypes: Array.isArray(raw.supportedDriveTypes)
      ? raw.supportedDriveTypes.filter(
          (value): value is string => typeof value === "string",
        )
      : [...defaultConfig.supportedDriveTypes],
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

function normalizeDriveTypes(payload: unknown): CloudSearchDriveType[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const raw = item as Record<string, unknown>;

    if (typeof raw.key !== "string" || typeof raw.label !== "string") {
      return [];
    }

    return [{ key: raw.key, label: raw.label }];
  });
}

function getDriveTypeIcon(typeKey: string) {
  return defaultDriveTypeIcons[typeKey] ?? CloudOutlined;
}

let cloudSearchConfigLoadRequest: Promise<CloudSearchConfig> | null = null;
let cloudSearchDriveTypesLoadRequest: Promise<CloudSearchDriveType[]> | null =
  null;

export function resetCloudSearchPanelState() {
  cloudSearchConfigLoadRequest = null;
  cloudSearchDriveTypesLoadRequest = null;
}

async function fetchCloudSearchConfig() {
  const response = await fetch("/api/admin/cloud-search");

  if (!response.ok) {
    throw new Error("网盘搜索配置读取失败");
  }

  return normalizeConfig(await response.json());
}

async function fetchCloudSearchDriveTypes() {
  const response = await fetch("/api/admin/cloud-search/types");

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, "支持的网盘类型读取失败"),
    );
  }

  return normalizeDriveTypes(await response.json());
}

function loadCloudSearchConfigOnce() {
  if (cloudSearchConfigLoadRequest) {
    return cloudSearchConfigLoadRequest;
  }

  const request = fetchCloudSearchConfig();
  cloudSearchConfigLoadRequest = request;

  void request
    .finally(() => {
      if (cloudSearchConfigLoadRequest === request) {
        cloudSearchConfigLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

function loadCloudSearchDriveTypesOnce() {
  if (cloudSearchDriveTypesLoadRequest) {
    return cloudSearchDriveTypesLoadRequest;
  }

  const request = fetchCloudSearchDriveTypes();
  cloudSearchDriveTypesLoadRequest = request;

  void request
    .finally(() => {
      if (cloudSearchDriveTypesLoadRequest === request) {
        cloudSearchDriveTypesLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

function normalizePanSouUrlInput(value: string) {
  const trimmed = value.trim();
  return trimmed || defaultConfig.panSouUrl;
}

function normalizeEnabledInput(value: unknown) {
  return value === false || value === "false" ? false : true;
}

function normalizeDriveTypeInput(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value.split(",").filter(Boolean);
  }

  return [];
}

function createSavePayload(config: Partial<CloudSearchFormValues>) {
  return {
    enabled: normalizeEnabledInput(config.enabled),
    panSouUrl: normalizePanSouUrlInput(String(config.panSouUrl ?? "")),
    requestTimeoutSeconds: normalizeTimeout(
      String(config.requestTimeoutSeconds),
    ),
    supportedDriveTypes: normalizeDriveTypeInput(config.supportedDriveTypes),
  };
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateSavePayload(payload: CloudSearchFormValues) {
  if (!payload.panSouUrl.trim()) {
    return "请输入 PanSou 服务地址。";
  }

  if (!isValidHttpUrl(payload.panSouUrl)) {
    return "请输入有效的 PanSou 服务地址。";
  }

  if (
    !Number.isInteger(payload.requestTimeoutSeconds) ||
    payload.requestTimeoutSeconds < 1
  ) {
    return "请求超时时间至少为 1 秒。";
  }

  if (payload.requestTimeoutSeconds > 120) {
    return "请求超时时间不能超过 120 秒。";
  }

  if (payload.supportedDriveTypes.length < 1) {
    return "请至少选择一种网盘类型。";
  }

  return null;
}

function createFormValues(config: CloudSearchConfig): CloudSearchFormValues {
  return {
    enabled: config.enabled,
    panSouUrl: config.panSouUrl,
    requestTimeoutSeconds: config.requestTimeoutSeconds,
    supportedDriveTypes: config.supportedDriveTypes,
  };
}

function defaultSupportedDriveTypesFromCatalog(
  driveTypes: CloudSearchDriveType[],
) {
  return driveTypes.map((type) => type.key);
}

function CloudSearchDriveTypeSelector({
  driveTypes,
  value = [],
  onChange,
}: {
  driveTypes: CloudSearchDriveType[];
  value?: unknown;
  onChange?: (types: string[]) => void;
}) {
  const [localSelectedDriveTypes, setLocalSelectedDriveTypes] = useState(() =>
    normalizeDriveTypeInput(value),
  );
  const selectedDriveTypes = localSelectedDriveTypes;
  const selectedDriveTypeSet = new Set(selectedDriveTypes);

  const toggleDriveType = (typeKey: string) => {
    const nextSelectedDriveTypes = selectedDriveTypeSet.has(typeKey)
      ? selectedDriveTypes.filter((selectedType) => selectedType !== typeKey)
      : [...selectedDriveTypes, typeKey];

    setLocalSelectedDriveTypes(nextSelectedDriveTypes);
    onChange?.(nextSelectedDriveTypes);
  };

  return (
    <div
      aria-label="支持的网盘类型"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      role="group"
    >
      {driveTypes.map((option) => {
        const Icon = getDriveTypeIcon(option.key);
        const isSelected = selectedDriveTypeSet.has(option.key);

        return (
          <button
            key={option.key}
            aria-checked={isSelected}
            type="button"
            data-drive-type-option={option.key}
            data-selected={String(isSelected)}
            className="group relative flex min-h-16 cursor-pointer items-start gap-3 overflow-hidden! rounded-xl border border-emerald-100/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fdf9_58%,#f1faf4_100%)] px-3.5 py-3 text-left shadow-sm shadow-emerald-950/3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf5_58%,#eaf7ee_100%)] hover:shadow-md hover:shadow-emerald-950/6 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-[linear-gradient(135deg,#f6fff8_0%,#e9faef_62%,#f6f9e8_100%)] data-[selected=true]:shadow-md data-[selected=true]:shadow-emerald-950/8"
            role="checkbox"
            onClick={() => toggleDriveType(option.key)}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-emerald-100/35 transition-colors duration-200 group-hover:bg-emerald-100/60 group-data-[selected=true]:bg-emerald-200/70"
            />
            <span className="relative flex min-w-0 flex-1 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-white text-lg text-emerald-600 shadow-sm shadow-emerald-950/4 transition-colors duration-200 group-hover:border-emerald-200 group-hover:bg-emerald-50 group-data-[selected=true]:border-emerald-400 group-data-[selected=true]:bg-emerald-100 group-data-[selected=true]:text-emerald-800">
                <Icon />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {option.label}
                </span>
                <span className="mt-1 block truncate text-xs leading-5 text-slate-500">
                  已接入 PanSou 类型
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CloudSearchPanel() {
  const { message: msg } = App.useApp();
  const [form] = Form.useForm<CloudSearchFormValues>();
  const [config, setConfig] = useState<CloudSearchConfig>(defaultConfig);
  const [driveTypes, setDriveTypes] = useState<CloudSearchDriveType[]>([]);
  const [loadMessage, setLoadMessage] = useState("尚未加载");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      setIsLoading(true);

      try {
        const [nextConfig, nextDriveTypes] = await Promise.all([
          loadCloudSearchConfigOnce(),
          loadCloudSearchDriveTypesOnce(),
        ]);

        if (!cancelled) {
          const loadedConfig = {
            ...nextConfig,
            supportedDriveTypes:
              nextConfig.supportedDriveTypes.length > 0
                ? nextConfig.supportedDriveTypes
                : defaultSupportedDriveTypesFromCatalog(nextDriveTypes),
          };
          setConfig(loadedConfig);
          form.setFieldsValue(createFormValues(loadedConfig));
          setDriveTypes(nextDriveTypes);
          setLoadMessage(`已加载 ${nextDriveTypes.length} 个类型`);
          msg.success("网盘搜索配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "网盘搜索配置读取失败";
          msg.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, [form, msg]);

  const saveConfig = async (values: CloudSearchFormValues) => {
    const payload = createSavePayload(values);
    const validationMessage = validateSavePayload(payload);

    if (validationMessage) {
      msg.error(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/cloud-search", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "网盘搜索配置保存失败"),
        );
      }

      const savedConfig = normalizeConfig(await response.json());
      setConfig(savedConfig);
      form.setFieldsValue(createFormValues(savedConfig));
      msg.success("网盘搜索配置已保存");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "网盘搜索配置保存失败";
      msg.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    const panSouUrl = normalizePanSouUrlInput(
      String(form.getFieldValue("panSouUrl") ?? ""),
    );

    setIsTesting(true);

    try {
      const response = await fetch("/api/admin/cloud-search/test", {
        body: JSON.stringify({ panSouUrl }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "网盘连接测试失败"),
        );
      }

      msg.success("网盘连接测试成功");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "网盘连接测试失败";
      msg.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CloudDownloadOutlined className="text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                网盘搜索
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              配置 PanSou 服务地址、请求超时和可展示的网盘类型，类型列表由
              PanSou 接口提供。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Tag color="blue">{loadMessage}</Tag>
            <Tag color={config.enabled ? "green" : "gold"}>
              {config.enabled ? "已启用" : "已停用"}
            </Tag>
          </div>
        </div>
      </div>

      <Form
        id="cloud-search-config-form"
        form={form}
        layout="vertical"
        onFinish={saveConfig}
      >
        <Alert
          type={config.enabled ? "success" : "warning"}
          title={config.enabled ? "网盘搜索功能已启动" : "网盘搜索功能未启动"}
          description="当前默认服务地址为 https://so.252035.xyz，支持类型由 PanSou 接口返回。"
          action={
            <a
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-default-300 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100"
              href="https://github.com/fish2018/pansou"
              rel="noreferrer"
              target="_blank"
            >
              <GithubOutlined />
              查看项目
            </a>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
          <div>
            <p className="text-sm font-medium text-foreground">启用网盘搜索</p>
            <p className="text-xs leading-5 text-default-500">
              控制前台是否展示并请求网盘搜索能力。
            </p>
          </div>
          <Form.Item name="enabled" valuePropName="checked" noStyle>
            <Switch
              aria-label="启动网盘搜索"
              disabled={isLoading}
              onChange={(checked) =>
                setConfig((current) => ({ ...current, enabled: checked }))
              }
            />
          </Form.Item>
        </div>

        <Form.Item
          className="pt-6"
          label="PanSou 服务地址"
          name="panSouUrl"
          help="填写 PanSou HTTP 服务根地址，保存后由后端搜索接口读取。"
          rules={[{ required: true, type: "url" }]}
        >
          <Input placeholder="例如 https://so.252035.xyz" />
        </Form.Item>

        <Form.Item
          label="请求超时时间（秒）"
          name="requestTimeoutSeconds"
          help="范围 1-120 秒，用于限制单次 PanSou 请求等待时间。"
        >
          <InputNumber
            min={1}
            max={120}
            controls={false}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-3">
          <div>
            <p className="text-sm font-medium text-default-500">
              支持的网盘类型
            </p>
            <p className="text-base font-semibold text-foreground">
              {config.supportedDriveTypes.length} / {driveTypes.length} 项已选
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              htmlType="button"
              loading={isTesting}
              onClick={() => void testConnection()}
            >
              <LinkOutlined />
              {isTesting ? "测试中" : "测试链接"}
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              <SaveOutlined />
              保存配置
            </Button>
          </div>
        </div>

        <Form.Item
          name="supportedDriveTypes"
          getValueFromEvent={(value: unknown) => value}
        >
          <CloudSearchDriveTypeSelector
            key={config.supportedDriveTypes.join("|")}
            driveTypes={driveTypes}
            onChange={(supportedDriveTypes) =>
              setConfig((current) => ({ ...current, supportedDriveTypes }))
            }
          />
        </Form.Item>
      </Form>
    </Card>
  );
}
