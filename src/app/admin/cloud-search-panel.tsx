"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Description,
  Form,
  Input,
  Label,
  Switch,
  TextField,
  toast,
} from "@heroui/react";

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

const defaultDriveTypeIcons: Record<string, string> = {
  "115": "bi-archive",
  "123": "bi-123",
  aliyun: "bi-hdd-network",
  baidu: "bi-cloud-fill",
  ed2k: "bi-link-45deg",
  magnet: "bi-magnet",
  mobile: "bi-phone",
  pikpak: "bi-box-seam",
  quark: "bi-lightning-charge",
  tianyi: "bi-cloud-check",
  uc: "bi-compass",
  xunlei: "bi-download",
};

const defaultConfig: CloudSearchConfig = {
  enabled: true,
  panSouUrl: "https://so.252035.xyz",
  requestTimeoutSeconds: 30,
  supportedDriveTypes: [],
  updatedAt: null,
};

const cloudSearchConfigSchema = z
  .object({
    enabled: z.boolean(),
    panSouUrl: z.string().trim().min(1, "请输入 PanSou 服务地址。"),
    requestTimeoutSeconds: z.number().int().min(1, "请求超时时间至少为 1 秒。").max(120, "请求超时时间不能超过 120 秒。"),
    supportedDriveTypes: z.array(z.string().trim()).min(1, "请至少选择一种网盘类型。"),
  })
  .strict();

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
  const raw = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

  return {
    enabled: raw.enabled === false ? false : true,
    panSouUrl: typeof raw.panSouUrl === "string" ? raw.panSouUrl : defaultConfig.panSouUrl,
    requestTimeoutSeconds:
      typeof raw.requestTimeoutSeconds === "number"
        ? normalizeTimeout(String(raw.requestTimeoutSeconds))
        : defaultConfig.requestTimeoutSeconds,
    supportedDriveTypes: Array.isArray(raw.supportedDriveTypes)
      ? raw.supportedDriveTypes.filter((value): value is string => typeof value === "string")
      : [...defaultConfig.supportedDriveTypes],
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
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
  return defaultDriveTypeIcons[typeKey] ?? "bi-cloud";
}

let cloudSearchConfigLoadRequest: Promise<CloudSearchConfig> | null = null;
let cloudSearchDriveTypesLoadRequest: Promise<CloudSearchDriveType[]> | null = null;

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
    throw new Error(await readApiErrorMessage(response, "支持的网盘类型读取失败"));
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

function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "表单校验失败。";
}

function normalizePanSouUrlInput(value: string) {
  const trimmed = value.trim();
  return trimmed || defaultConfig.panSouUrl;
}

function createSavePayload(config: CloudSearchConfig) {
  return {
    enabled: config.enabled,
    panSouUrl: normalizePanSouUrlInput(config.panSouUrl),
    requestTimeoutSeconds: config.requestTimeoutSeconds,
    supportedDriveTypes: config.supportedDriveTypes,
  };
}

function defaultSupportedDriveTypesFromCatalog(driveTypes: CloudSearchDriveType[]) {
  return driveTypes.map((type) => type.key);
}

function CloudSearchDriveTypeSelector({
  driveTypes,
  selectedDriveTypes,
  onSelectionChange,
}: {
  driveTypes: CloudSearchDriveType[];
  selectedDriveTypes: string[];
  onSelectionChange: (types: string[]) => void;
}) {
  return (
    <CheckboxGroup
      aria-label="支持的网盘类型"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      value={selectedDriveTypes}
      onChange={onSelectionChange}
    >
      {driveTypes.map((option) => (
        <Checkbox
          key={option.key}
          value={option.key}
          className={({ isFocusVisible, isSelected }) =>
            [
              "group flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
              "bg-[var(--surface)] hover:border-accent/60 hover:bg-accent/5",
              isSelected ? "border-accent/70 bg-accent/10 shadow-sm shadow-accent/10" : "border-default-200/80",
              isFocusVisible ? "outline outline-2 outline-offset-2 outline-accent" : "outline-none",
            ].join(" ")
          }
        >
          {({ isSelected }) => (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={[
                    "grid size-8 shrink-0 place-items-center rounded-xl transition",
                    isSelected ? "bg-accent text-accent-foreground" : "bg-background text-accent",
                  ].join(" ")}
                >
                  <i aria-hidden="true" className={`bi ${getDriveTypeIcon(option.key)}`} />
                </span>
                <span className="truncate text-sm font-medium text-foreground">{option.label}</span>
              </span>
              <span
                aria-hidden="true"
                className={[
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] transition",
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-default-300 bg-background text-transparent",
                ].join(" ")}
              >
                <i className="bi bi-check-lg" />
              </span>
            </>
          )}
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
}

export function CloudSearchPanel() {
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
          setConfig({
            ...nextConfig,
            supportedDriveTypes:
              nextConfig.supportedDriveTypes.length > 0
                ? nextConfig.supportedDriveTypes
                : defaultSupportedDriveTypesFromCatalog(nextDriveTypes),
          });
          setDriveTypes(nextDriveTypes);
          setLoadMessage(`已加载 ${nextDriveTypes.length} 个类型`);
          toast.success("网盘搜索配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "网盘搜索配置读取失败";
          toast.danger(message);
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
  }, []);

  const saveConfig = async () => {
    const parsed = cloudSearchConfigSchema.safeParse(createSavePayload(config));

    if (!parsed.success) {
      toast.danger(getZodErrorMessage(parsed.error));
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/cloud-search", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "网盘搜索配置保存失败"));
      }

      setConfig(normalizeConfig(await response.json()));
      toast.success("网盘搜索配置已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "网盘搜索配置保存失败";
      toast.danger(message);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    const parsedUrl = z
      .string()
      .trim()
      .transform((value) => value || defaultConfig.panSouUrl)
      .safeParse(config.panSouUrl);

    if (!parsedUrl.success) {
      toast.danger(getZodErrorMessage(parsedUrl.error));
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/admin/cloud-search/test", {
        body: JSON.stringify({ panSouUrl: parsedUrl.data }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "网盘连接测试失败"));
      }

      toast.success("网盘连接测试成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "网盘连接测试失败";
      toast.danger(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <i aria-hidden="true" className="bi bi-cloud-arrow-down text-2xl text-accent" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">网盘搜索</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
              配置 PanSou 服务地址、请求超时和可展示的网盘类型，类型列表由 PanSou 接口提供。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Chip color="accent" variant="soft">
              {loadMessage}
            </Chip>
            <Chip color={config.enabled ? "success" : "warning"} variant="soft">
              {config.enabled ? "已启用" : "已停用"}
            </Chip>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="space-y-6 p-6 pt-5 md:p-8 md:pt-5">
        <section className="rounded-3xl border border-default-200/80 bg-background/50 p-4 md:p-5">
          <Form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveConfig();
            }}
          >
            <Alert status={config.enabled ? "accent" : "warning"}>
              <Alert.Indicator />
              <Alert.Content className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <Alert.Title>{config.enabled ? "网盘搜索功能已启动" : "网盘搜索功能未启动"}</Alert.Title>
                  <Alert.Description>
                    当前默认服务地址为 https://so.252035.xyz，支持类型由 PanSou 接口返回。
                  </Alert.Description>
                </span>
                <a
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-default-300 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100"
                  href="https://github.com/fish2018/pansou"
                  rel="noreferrer"
                  target="_blank"
                >
                  <i aria-hidden="true" className="bi bi-github" />
                  查看项目
                </a>
              </Alert.Content>
            </Alert>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/80 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">启用网盘搜索</p>
                <p className="text-xs leading-5 text-default-500">控制前台是否展示并请求网盘搜索能力。</p>
              </div>
              <Switch
                aria-label="启动网盘搜索"
                isDisabled={isLoading}
                isSelected={config.enabled}
                onChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <TextField fullWidth name="panSouUrl">
              <Label>PanSou 服务地址</Label>
              <Input
                value={config.panSouUrl}
                onChange={(event) => setConfig((current) => ({ ...current, panSouUrl: event.target.value }))}
                placeholder="例如 https://so.252035.xyz"
              />
              <Description>填写 PanSou HTTP 服务根地址，保存后由后端搜索接口读取。</Description>
            </TextField>

            <TextField fullWidth name="requestTimeoutSeconds">
              <Label>请求超时时间（秒）</Label>
              <Input
                inputMode="numeric"
                min={1}
                max={120}
                type="number"
                value={String(config.requestTimeoutSeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    requestTimeoutSeconds: normalizeTimeout(event.target.value),
                  }))
                }
              />
              <Description>范围 1-120 秒，用于限制单次 PanSou 请求等待时间。</Description>
            </TextField>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" type="button" onPress={() => void testConnection()} isDisabled={isTesting}>
                <i aria-hidden="true" className="bi bi-link-45deg" />
                {isTesting ? "测试中" : "测试链接"}
              </Button>
              <Button variant="primary" type="submit" isDisabled={isSaving}>
                <i aria-hidden="true" className="bi bi-save" />
                {isSaving ? "保存中" : "保存配置"}
              </Button>
            </div>
          </Form>
        </section>

        <section className="space-y-4 rounded-3xl border border-default-200/80 bg-background/70 p-4 md:p-5">
          <div>
            <p className="text-sm font-medium text-default-500">支持的网盘类型</p>
            <p className="text-base font-semibold text-foreground">
              {config.supportedDriveTypes.length} / {driveTypes.length} 项已选
            </p>
          </div>
          <CloudSearchDriveTypeSelector
            driveTypes={driveTypes}
            selectedDriveTypes={config.supportedDriveTypes}
            onSelectionChange={(supportedDriveTypes) => setConfig((current) => ({ ...current, supportedDriveTypes }))}
          />
        </section>
      </Card.Content>
    </Card>
  );
}
