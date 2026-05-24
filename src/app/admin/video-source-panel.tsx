"use client";

import {
  AlertOutlined,
  ApiOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  GlobalOutlined,
  PlusOutlined,
  SyncOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  VideoSourceCollection,
  VideoSourceItem,
  VideoSourceBatchAction,
  VideoSourceStatus,
  VideoSourceType,
  VideoSourceValidity,
} from "@/modules/admin";

type EditableVideoSource = {
  originalKey: string | null;
  name: string;
  key: string;
  apiUrl: string;
  status: VideoSourceStatus;
  adult: boolean;
  type: VideoSourceType;
  weight: number;
  validity: VideoSourceValidity;
};

type VideoSourceFormValues = {
  adult: boolean;
  apiUrl: string;
  name: string;
  sourceKey: string;
  status: VideoSourceStatus;
  type: VideoSourceType;
  weight: number;
};

type ValidityCheckFormValues = {
  validityKeyword: string;
};

const sourceStatusLabelMap: Record<VideoSourceStatus, string> = {
  enabled: "启用",
  disabled: "禁用",
};

const sourceTypeLabelMap: Record<VideoSourceType, string> = {
  normal: "普通",
  "short-drama": "短剧",
};

const sourceValidityLabelMap: Record<VideoSourceValidity, string> = {
  checking: "检测中",
  valid: "可用",
  warning: "待检测",
  invalid: "异常",
};

const sourceValidityColorMap: Record<VideoSourceValidity, string> = {
  checking: "processing",
  valid: "success",
  warning: "warning",
  invalid: "error",
};

const sourceValidityIconMap: Record<VideoSourceValidity, typeof SyncOutlined> =
  {
    checking: SyncOutlined,
    valid: CheckCircleFilled,
    warning: WarningFilled,
    invalid: AlertOutlined,
  };

const defaultValidityKeyword = "斗罗大陆";

const defaultDraft: EditableVideoSource = {
  originalKey: null,
  name: "",
  key: "",
  apiUrl: "",
  status: "disabled",
  adult: false,
  type: "normal",
  weight: 50,
  validity: "warning",
};

let videoSourcesLoadRequest: Promise<VideoSourceCollection> | null = null;

export function resetVideoSourcePanelState() {
  videoSourcesLoadRequest = null;
}

const normalizeSourceWeight = (value: string) => {
  const weight = Number(value);

  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.min(99, Math.max(1, Math.round(weight)));
};

function isVideoSourceStatus(value: unknown): value is VideoSourceStatus {
  return value === "enabled" || value === "disabled";
}

function isVideoSourceType(value: unknown): value is VideoSourceType {
  return value === "normal" || value === "short-drama";
}

function isVideoSourceValidity(value: unknown): value is VideoSourceValidity {
  return (
    value === "checking" ||
    value === "valid" ||
    value === "warning" ||
    value === "invalid"
  );
}

function normalizeVideoSourceItem(payload: unknown): VideoSourceItem | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const raw = payload as Record<string, unknown>;

  if (
    typeof raw.name !== "string" ||
    typeof raw.key !== "string" ||
    typeof raw.apiUrl !== "string" ||
    typeof raw.adult !== "boolean" ||
    !isVideoSourceStatus(raw.status) ||
    !isVideoSourceType(raw.type)
  ) {
    return null;
  }

  return {
    name: raw.name,
    key: raw.key,
    apiUrl: raw.apiUrl,
    no:
      typeof raw.no === "number" && Number.isFinite(raw.no)
        ? Math.max(0, Math.round(raw.no))
        : 0,
    status: raw.status,
    adult: raw.adult,
    type: raw.type,
    weight:
      typeof raw.weight === "number"
        ? normalizeSourceWeight(String(raw.weight))
        : 50,
    validity: isVideoSourceValidity(raw.validity) ? raw.validity : "warning",
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

function normalizeVideoSourceCollection(
  payload: unknown,
): VideoSourceCollection {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { sources: [], updatedAt: null };
  }

  const raw = payload as Record<string, unknown>;
  const sources = Array.isArray(raw.sources)
    ? raw.sources.flatMap((source) => {
        const normalized = normalizeVideoSourceItem(source);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    sources,
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
  };
}

function normalizeValidityCheckResult(
  payload: unknown,
): Pick<VideoSourceItem, "key" | "validity"> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const raw = payload as Record<string, unknown>;

  if (typeof raw.key !== "string" || !isVideoSourceValidity(raw.validity)) {
    return null;
  }

  return {
    key: raw.key,
    validity: raw.validity,
  };
}

function parseSseEvent(block: string) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return { data: JSON.parse(dataLines.join("\n")) as unknown, event };
  } catch {
    return null;
  }
}

async function readApiErrorMessage(response: Response, fallback: string) {
  if (response.status !== 400) {
    return fallback;
  }

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

async function requestJson<TPayload>(
  url: string,
  options: RequestInit,
  fallbackErrorMessage: string,
  normalize: (payload: unknown) => TPayload,
) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackErrorMessage));
  }

  return normalize(await response.json());
}

function loadVideoSourcesOnce() {
  if (videoSourcesLoadRequest) {
    return videoSourcesLoadRequest;
  }

  const request = requestJson(
    "/api/admin/video-sources",
    { method: "GET" },
    "视频源配置读取失败",
    normalizeVideoSourceCollection,
  );
  videoSourcesLoadRequest = request;

  void request
    .finally(() => {
      if (videoSourcesLoadRequest === request) {
        videoSourcesLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

function createDraftFromSource(source: VideoSourceItem): EditableVideoSource {
  return {
    originalKey: source.key,
    name: source.name,
    key: source.key,
    apiUrl: source.apiUrl,
    status: source.status,
    adult: source.adult,
    type: source.type,
    weight: source.weight,
    validity: source.validity,
  };
}

function createFormValuesFromDraft(
  draft: EditableVideoSource,
): VideoSourceFormValues {
  return {
    adult: draft.adult,
    apiUrl: draft.apiUrl,
    name: draft.name,
    sourceKey: draft.key,
    status: draft.status,
    type: draft.type,
    weight: draft.weight,
  };
}

function createDraftFromFormValues(
  values: VideoSourceFormValues,
  originalKey: string | null,
): EditableVideoSource {
  return {
    adult: Boolean(values.adult),
    apiUrl: values.apiUrl,
    key: values.sourceKey,
    name: values.name,
    originalKey,
    status: values.status,
    type: values.type,
    validity: "warning",
    weight: normalizeSourceWeight(String(values.weight)),
  };
}

function createSourcePayload(draft: EditableVideoSource) {
  return {
    name: draft.name.trim(),
    key: draft.key.trim(),
    apiUrl: draft.apiUrl.trim(),
    status: draft.status,
    adult: draft.adult,
    type: draft.type,
    weight: draft.weight,
    validity: draft.validity,
  };
}

function formatLastUpdated(value: string | null) {
  if (!value) {
    return "未保存";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function validateDraft(draft: EditableVideoSource) {
  const payload = createSourcePayload(draft);

  if (!payload.name) {
    return "请输入视频源名称。";
  }

  if (!payload.key) {
    return "请输入视频源 KEY。";
  }

  try {
    const url = new URL(payload.apiUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "请输入有效的 API 地址。";
    }
  } catch {
    return "请输入有效的 API 地址。";
  }

  return null;
}

export function VideoSourcePanel() {
  const { message: msg } = App.useApp();
  const [sourceForm] = Form.useForm<VideoSourceFormValues>();
  const [validityForm] = Form.useForm<ValidityCheckFormValues>();
  const [sources, setSources] = useState<VideoSourceItem[]>([]);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([]);
  const [editingSource, setEditingSource] =
    useState<EditableVideoSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [operationSourceKey, setOperationSourceKey] = useState<string | null>(
    null,
  );
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [isValidityChecking, setIsValidityChecking] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isValidityModalOpen, setIsValidityModalOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const sourceKeys = useMemo(
    () => sources.map((source) => source.key),
    [sources],
  );
  const selectedSourceKeySet = useMemo(
    () => new Set(selectedSourceKeys.filter((key) => sourceKeys.includes(key))),
    [selectedSourceKeys, sourceKeys],
  );
  const selectedCount = selectedSourceKeySet.size;
  const enabledCount = sources.filter(
    (source) => source.status === "enabled",
  ).length;
  const disabledCount = sources.filter(
    (source) => source.status === "disabled",
  ).length;
  const invalidCount = sources.filter(
    (source) => source.validity === "invalid",
  ).length;
  const sourceTotal = sources.length;
  const enabledPercent =
    sourceTotal > 0 ? Math.round((enabledCount / sourceTotal) * 100) : 0;
  const disabledPercent =
    sourceTotal > 0 ? Math.round((disabledCount / sourceTotal) * 100) : 0;
  const invalidPercent =
    sourceTotal > 0 ? Math.round((invalidCount / sourceTotal) * 100) : 0;
  const statItems = [
    {
      helper: "可参与搜索",
      icon: <CheckCircleFilled />,
      label: "启用",
      progressClassName: "bg-accent",
      value: enabledCount,
      width: enabledPercent,
    },
    {
      helper: "暂不参与聚合",
      icon: <WarningFilled />,
      label: "禁用",
      progressClassName: "bg-amber-500",
      value: disabledCount,
      width: disabledPercent,
    },
    {
      helper: "需要排查接口",
      icon: <AlertOutlined />,
      label: "异常",
      progressClassName: "bg-red-500",
      value: invalidCount,
      width: invalidPercent,
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadVideoSources() {
      setIsLoading(true);

      try {
        const data = await loadVideoSourcesOnce();

        if (!cancelled) {
          setSources(data.sources);
          setSelectedSourceKeys([]);
          setLastUpdated(data.updatedAt);
          msg.success("视频源配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "视频源配置读取失败";
          msg.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadVideoSources();

    return () => {
      cancelled = true;
    };
  }, [msg]);

  const updateSourcesFromCollection = (collection: VideoSourceCollection) => {
    setSources(collection.sources);
    setLastUpdated(collection.updatedAt);
    setSelectedSourceKeys((current) =>
      current.filter((key) =>
        collection.sources.some((source) => source.key === key),
      ),
    );
  };

  const saveSourcePatch = async (
    key: string,
    patch: Partial<VideoSourceItem>,
    successMessage: string,
  ) => {
    const previousSources = sources;
    setSources((current) =>
      current.map((source) =>
        source.key === key ? { ...source, ...patch } : source,
      ),
    );
    setOperationSourceKey(key);

    try {
      const data = await requestJson(
        `/api/admin/video-sources/${encodeURIComponent(key)}`,
        {
          body: JSON.stringify(patch),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
        "视频源保存失败",
        normalizeVideoSourceCollection,
      );
      updateSourcesFromCollection(data);
      msg.success(successMessage);
    } catch (error) {
      setSources(previousSources);
      const message = error instanceof Error ? error.message : "视频源保存失败";
      msg.error(message);
    } finally {
      setOperationSourceKey(null);
    }
  };

  const deleteSource = async (key: string) => {
    setOperationSourceKey(key);

    try {
      const data = await requestJson(
        `/api/admin/video-sources/${encodeURIComponent(key)}`,
        { method: "DELETE" },
        "视频源删除失败",
        normalizeVideoSourceCollection,
      );
      updateSourcesFromCollection(data);
      if (editingSource?.originalKey === key) {
        setEditingSource(null);
        setIsEditModalOpen(false);
      }
      msg.success("视频源已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "视频源删除失败";
      msg.error(message);
    } finally {
      setOperationSourceKey(null);
    }
  };

  const addSource = () => {
    const draft = { ...defaultDraft };
    sourceForm.setFieldsValue(createFormValuesFromDraft(draft));
    setEditingSource(draft);
    setIsEditModalOpen(true);
  };

  const openValidityCheck = () => {
    validityForm.setFieldsValue({ validityKeyword: defaultValidityKeyword });
    setIsValidityModalOpen(true);
  };

  const closeValidityCheck = () => {
    if (isValidityChecking) {
      return;
    }

    validityForm.setFieldsValue({ validityKeyword: "" });
    setIsValidityModalOpen(false);
  };

  const runValidityCheck = async (values: ValidityCheckFormValues) => {
    const keyword = values.validityKeyword.trim();

    if (!keyword) {
      msg.error("请输入检测关键词。");
      return;
    }

    setIsValidityChecking(true);
    setSources((current) =>
      current.map((source) => ({ ...source, validity: "checking" })),
    );
    setIsValidityModalOpen(false);

    try {
      const response = await fetch(
        `/api/admin/video-source/validity-check?keyword=${encodeURIComponent(keyword)}`,
        {
          headers: { Accept: "text/event-stream" },
          method: "GET",
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("视频源有效性检测失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const message = parseSseEvent(block);

          if (!message) {
            continue;
          }

          if (message.event === "result") {
            const result = normalizeValidityCheckResult(message.data);

            if (result) {
              setSources((current) =>
                current.map((source) =>
                  source.key === result.key
                    ? { ...source, validity: result.validity }
                    : source,
                ),
              );
            }
          } else if (message.event === "complete") {
            updateSourcesFromCollection(
              normalizeVideoSourceCollection(message.data),
            );
          } else if (message.event === "error") {
            const raw = message.data;
            const messageText =
              raw &&
              typeof raw === "object" &&
              !Array.isArray(raw) &&
              typeof (raw as Record<string, unknown>).message === "string"
                ? String((raw as Record<string, unknown>).message)
                : "视频源有效性检测失败";
            throw new Error(messageText);
          }
        }
      }

      msg.success("视频源有效性检测完成");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "视频源有效性检测失败";
      msg.error(message);
    } finally {
      setIsValidityChecking(false);
    }
  };

  const saveEditingSource = async (values: VideoSourceFormValues) => {
    if (!editingSource) {
      return;
    }

    const draft = createDraftFromFormValues(values, editingSource.originalKey);
    const validationMessage = validateDraft(draft);

    if (validationMessage) {
      msg.error(validationMessage);
      return;
    }

    const payload = createSourcePayload(draft);
    setIsSaving(true);

    try {
      if (draft.originalKey) {
        const data = await requestJson(
          `/api/admin/video-sources/${encodeURIComponent(draft.originalKey)}`,
          {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          },
          "视频源保存失败",
          normalizeVideoSourceCollection,
        );
        updateSourcesFromCollection(data);
        msg.success("视频源已保存");
      } else {
        const created = await requestJson(
          "/api/admin/video-source",
          {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
          "视频源创建失败",
          (raw) => {
            const item = normalizeVideoSourceItem(raw);

            if (!item) {
              throw new Error("视频源创建失败");
            }

            return item;
          },
        );
        setSources((current) => [...current, created]);
        msg.success("视频源已添加");
      }

      sourceForm.setFieldsValue(createFormValuesFromDraft(defaultDraft));
      setEditingSource(null);
      setIsEditModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "视频源保存失败";
      msg.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSelectedSources = async (
    action: VideoSourceBatchAction,
    successMessage: string,
  ) => {
    if (selectedCount === 0) {
      return;
    }

    setIsBatchSaving(true);

    try {
      const data = await requestJson(
        "/api/admin/video-source/batch",
        {
          body: JSON.stringify({
            action,
            keys: Array.from(selectedSourceKeySet),
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
        "批量操作失败",
        normalizeVideoSourceCollection,
      );
      updateSourcesFromCollection(data);
      msg.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量操作失败";
      msg.error(message);
    } finally {
      setIsBatchSaving(false);
    }
  };

  const deleteSelectedSources = async () => {
    if (selectedCount === 0) {
      return;
    }

    setIsBatchSaving(true);

    try {
      let latestSources = sources;

      for (const key of selectedSourceKeySet) {
        const data = await requestJson(
          `/api/admin/video-sources/${encodeURIComponent(key)}`,
          { method: "DELETE" },
          "批量删除失败",
          normalizeVideoSourceCollection,
        );
        latestSources = data.sources;
      }

      setSources(latestSources);
      setSelectedSourceKeys([]);
      msg.success("视频源已批量删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量删除失败";
      msg.error(message);
    } finally {
      setIsBatchSaving(false);
    }
  };

  const handleTableSelectionChange = (keys: string[]) => {
    setSelectedSourceKeys(keys);
  };

  const openEditSource = (source: VideoSourceItem) => {
    const draft = createDraftFromSource(source);
    sourceForm.setFieldsValue(createFormValuesFromDraft(draft));
    setEditingSource(draft);
    setIsEditModalOpen(true);
  };

  const closeEditSource = () => {
    sourceForm.setFieldsValue(createFormValuesFromDraft(defaultDraft));
    setEditingSource(null);
    setIsEditModalOpen(false);
  };

  const allSelected =
    sources.length > 0 && selectedSourceKeySet.size === sources.length;
  const isIndeterminate = selectedSourceKeySet.size > 0 && !allSelected;
  const columns: ColumnsType<VideoSourceItem> = [
    {
      key: "selection",
      title: (
        <input
          aria-label="选择全部视频源"
          checked={allSelected}
          ref={(element) => {
            if (element) {
              element.indeterminate = isIndeterminate;
            }
          }}
          type="checkbox"
          onChange={() =>
            handleTableSelectionChange(
              allSelected ? [] : sources.map((source) => source.key),
            )
          }
        />
      ),
      render: (_, source) => (
        <input
          aria-label={`选择${source.name}`}
          checked={selectedSourceKeySet.has(source.key)}
          type="checkbox"
          onChange={() => {
            const nextKeys = new Set(selectedSourceKeySet);

            if (nextKeys.has(source.key)) {
              nextKeys.delete(source.key);
            } else {
              nextKeys.add(source.key);
            }

            handleTableSelectionChange(Array.from(nextKeys));
          }}
        />
      ),
    },
    {
      dataIndex: "name",
      title: "名称",
      render: (name: VideoSourceItem["name"]) => (
        <span className="font-medium text-foreground">{name}</span>
      ),
    },
    {
      dataIndex: "key",
      title: "KEY",
      render: (key: VideoSourceItem["key"]) => (
        <span className="font-mono text-xs text-default-600">{key}</span>
      ),
    },
    {
      dataIndex: "status",
      title: "状态",
      render: (status: VideoSourceStatus) => (
        <Tag color={status === "enabled" ? "success" : "default"}>
          {sourceStatusLabelMap[status]}
        </Tag>
      ),
    },
    {
      dataIndex: "adult",
      title: "成人资源",
      render: (adult: boolean, source) => (
        <Switch
          aria-label={`切换${source.name}成人资源`}
          checked={adult}
          disabled={operationSourceKey === source.key}
          onChange={() =>
            saveSourcePatch(source.key, { adult: !adult }, "视频源已保存")
          }
        />
      ),
    },
    {
      dataIndex: "type",
      title: "源类型",
      render: (type: VideoSourceType) => (
        <Tag color={type === "short-drama" ? "processing" : "default"}>
          {sourceTypeLabelMap[type]}
        </Tag>
      ),
    },
    {
      dataIndex: "weight",
      title: "权重",
      render: (weight: VideoSourceItem["weight"]) => (
        <Tag color="processing">{weight}</Tag>
      ),
    },
    {
      dataIndex: "validity",
      title: "有效性",
      render: (validity: VideoSourceValidity) => {
        const Icon = sourceValidityIconMap[validity];

        return (
          <Tag color={sourceValidityColorMap[validity]}>
            <span className="inline-flex items-center gap-1.5">
              <Icon spin={validity === "checking"} />
              {sourceValidityLabelMap[validity]}
            </span>
          </Tag>
        );
      },
    },
    {
      align: "right",
      key: "actions",
      title: "操作",
      render: (_, source) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            disabled={operationSourceKey === source.key}
            size="small"
            type={source.status === "enabled" ? "default" : "primary"}
            danger={source.status === "enabled"}
            onClick={() =>
              saveSourcePatch(
                source.key,
                {
                  status: source.status === "enabled" ? "disabled" : "enabled",
                },
                source.status === "enabled" ? "视频源已禁用" : "视频源已启用",
              )
            }
          >
            {source.status === "enabled" ? "禁用" : "启用"}
          </Button>
          <Button
            disabled={operationSourceKey === source.key}
            size="small"
            onClick={() => openEditSource(source)}
          >
            编辑
          </Button>
          <Button
            danger
            disabled={operationSourceKey === source.key}
            size="small"
            onClick={() => deleteSource(source.key)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card loading={isLoading}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <GlobalOutlined className="text-2xl text-accent" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    视频源配置
                  </h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                管理视频源基础信息、启用状态、成人资源标记、权重和检测结果。
              </p>
            </div>

            <Tag color={isLoading ? "processing" : "success"}>
              {isLoading ? "加载中" : `视频源 ${sources.length} 个`}
            </Tag>
          </div>
        </div>

        <div
          className="mb-6 overflow-hidden rounded-lg border border-(--ant-color-border) bg-surface"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4 border-b border-(--ant-color-border) px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <BarChartOutlined className="text-xl" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  视频源统计
                </p>
                <p className="mt-1 text-xs leading-5 text-default-500">
                  当前视频源启用状态和接口有效性概览。
                </p>
              </div>
            </div>
            <p className="text-xs text-default-500 md:text-sm">
              最后更新时间 {formatLastUpdated(lastUpdated)}
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(15rem,0.95fr)_minmax(0,2fr)]">
            <div className="border-b border-(--ant-color-border) p-4 lg:border-b-0 lg:border-r">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-default-500">
                    Source total
                  </p>
                  <p className="mt-2 text-4xl font-semibold text-foreground">
                    {sourceTotal}
                  </p>
                  <p className="mt-2 text-sm text-default-500">视频源总数</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <ApiOutlined className="text-lg" />
                </span>
              </div>

              <div
                className="mt-5 flex h-2 overflow-hidden rounded-full bg-surface-secondary"
                aria-label={`启用视频源 ${enabledPercent}%，禁用视频源 ${disabledPercent}%`}
              >
                <div
                  className="bg-accent"
                  style={{ width: `${enabledPercent}%` }}
                />
                <div
                  className="bg-danger"
                  style={{ width: `${invalidPercent}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-default-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  启用 {enabledPercent}%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  异常 {invalidPercent}%
                </span>
              </div>
            </div>

            <div className="grid divide-y divide-(--ant-color-border) text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
              {statItems.map((item) => (
                <div key={item.label} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      {item.icon}
                    </span>
                    <span className="text-xs font-medium text-default-500">
                      {item.width}%
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs text-default-500">
                        {item.helper}
                      </p>
                    </div>
                    <span className="text-2xl font-semibold text-foreground">
                      {item.value}
                    </span>
                  </div>
                  <div
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-secondary"
                    aria-label={`${item.label}占比 ${item.width}%`}
                  >
                    <div
                      className={`h-full rounded-full ${item.progressClassName}`}
                      style={{ width: `${item.width}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 pb-0 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <GlobalOutlined className="text-xl text-accent" />
              <p className="mb-0! text-sm font-medium text-foreground">
                视频源列表
              </p>
              <span className="text-sm text-default-500">
                已选择 {selectedCount} 项
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedCount > 0 ? (
                <>
                  <Button
                    disabled={isBatchSaving}
                    size="small"
                    onClick={() =>
                      updateSelectedSources("enable", "视频源已批量启用")
                    }
                  >
                    批量启用
                  </Button>
                  <Button
                    disabled={isBatchSaving}
                    size="small"
                    onClick={() =>
                      updateSelectedSources("disable", "视频源已批量禁用")
                    }
                  >
                    批量禁用
                  </Button>
                  <Button
                    danger
                    disabled={isBatchSaving}
                    size="small"
                    onClick={deleteSelectedSources}
                  >
                    批量删除
                  </Button>
                </>
              ) : null}
              <Button
                disabled={
                  isLoading || sources.length === 0 || isValidityChecking
                }
                size="small"
                onClick={openValidityCheck}
              >
                {isValidityChecking ? "检测中" : "有效性检测"}
              </Button>
              <Button
                disabled={isLoading}
                size="small"
                type="primary"
                onClick={addSource}
              >
                <PlusOutlined />
                添加
              </Button>
            </div>
          </div>

          <Table<VideoSourceItem>
            bordered
            columns={columns}
            dataSource={sources}
            pagination={false}
            rowKey="key"
            onRow={(source) =>
              ({
                "data-source-key": source.key,
              }) as HTMLAttributes<HTMLTableRowElement>
            }
          />
        </div>
      </Card>

      <Modal
        open={isEditModalOpen}
        title={editingSource?.originalKey ? "编辑视频源" : "添加视频源"}
        onCancel={closeEditSource}
        onOk={sourceForm.submit}
        confirmLoading={isSaving}
      >
        <Divider />
        {editingSource ? (
          <Form<VideoSourceFormValues>
            form={sourceForm}
            layout="vertical"
            onFinish={(values) => {
              void saveEditingSource(values);
            }}
          >
            <Form.Item label="名称" name="name" rules={[{ required: true }]}>
              <Input placeholder="请输入视频源名称" />
            </Form.Item>

            <Form.Item
              label="KEY"
              name="sourceKey"
              rules={[{ required: true }]}
            >
              <Input
                placeholder="请输入视频源 KEY"
                readOnly={Boolean(editingSource.originalKey)}
              />
            </Form.Item>

            <Form.Item
              label="API 地址"
              name="apiUrl"
              rules={[{ required: true, type: "url" }]}
            >
              <Input placeholder="https://example.com/api.php" />
            </Form.Item>

            <Row gutter={[10, 10]}>
              <Col span={24} md={{ span: 12 }}>
                <Form.Item label="状态" name="status">
                  <Select
                    options={[
                      { label: "启用", value: "enabled" },
                      { label: "禁用", value: "disabled" },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col span={24} md={{ span: 12 }}>
                <Form.Item label="源类型" name="type">
                  <Select
                    options={[
                      { label: "普通", value: "normal" },
                      { label: "短剧", value: "short-drama" },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[10, 10]}>
              <Col span={24} md={{ span: 12 }}>
                <Form.Item label="成人资源" name="adult">
                  <Select
                    options={[
                      { label: "是", value: true },
                      { label: "否", value: false },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col span={24} md={{ span: 12 }}>
                <Form.Item label="权重" name="weight">
                  <InputNumber
                    max={99}
                    min={1}
                    controls={false}
                    className="w-full"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        ) : null}
      </Modal>

      <Modal
        open={isValidityModalOpen}
        title="有效性检测"
        onCancel={closeValidityCheck}
        onOk={validityForm.submit}
        confirmLoading={isValidityChecking}
      >
        <Divider />
        <Form<ValidityCheckFormValues>
          form={validityForm}
          layout="vertical"
          onFinish={(values) => {
            void runValidityCheck(values);
          }}
        >
          <Form.Item
            label="关键词"
            name="validityKeyword"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入用于检测的视频关键词" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
