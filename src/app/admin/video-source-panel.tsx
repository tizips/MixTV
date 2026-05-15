"use client";

import type { Selection } from "@react-types/shared";
import { memo, type Key, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  Table,
  TextField,
  toast,
  useOverlayState,
} from "@heroui/react";
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

const sourceStatusChipColorMap: Record<VideoSourceStatus, "success" | "default"> = {
  enabled: "success",
  disabled: "default",
};

const sourceTypeChipColorMap: Record<VideoSourceType, "accent" | "default"> = {
  normal: "default",
  "short-drama": "accent",
};

const sourceValidityChipColorMap: Record<VideoSourceValidity, "accent" | "danger" | "success" | "warning"> = {
  checking: "accent",
  valid: "success",
  warning: "warning",
  invalid: "danger",
};

const sourceValidityIconMap: Record<VideoSourceValidity, string> = {
  checking: "bi-arrow-repeat",
  valid: "bi-check-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  invalid: "bi-x-circle-fill",
};

const tableActionButtonClassName = "h-7 px-2 text-xs";
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
  return value === "checking" || value === "valid" || value === "warning" || value === "invalid";
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
    no: typeof raw.no === "number" && Number.isFinite(raw.no) ? Math.max(0, Math.round(raw.no)) : 0,
    status: raw.status,
    adult: raw.adult,
    type: raw.type,
    weight: typeof raw.weight === "number" ? normalizeSourceWeight(String(raw.weight)) : 50,
    validity: isVideoSourceValidity(raw.validity) ? raw.validity : "warning",
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
  };
}

function normalizeVideoSourceCollection(payload: unknown): VideoSourceCollection {
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
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
  };
}

function normalizeValidityCheckResult(payload: unknown): Pick<VideoSourceItem, "key" | "validity"> | null {
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

function VideoSourceSelect<TValue extends string>({
  label,
  selectedKey,
  options,
  onSelectionChange,
}: {
  label: string;
  selectedKey: TValue;
  options: Array<{ value: TValue; label: string }>;
  onSelectionChange: (value: TValue) => void;
}) {
  const handleSelectionChange = (key: Key | null) => {
    if (key == null) {
      return;
    }

    onSelectionChange(String(key) as TValue);
  };

  return (
    <Select fullWidth selectedKey={selectedKey} onSelectionChange={handleSelectionChange}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox className="bg-[var(--surface)]">
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

type VideoSourceTableProps = {
  operationSourceKey: string | null;
  onDeleteSource: (key: string) => void;
  onOpenEditSource: (source: VideoSourceItem) => void;
  onSaveSourcePatch: (key: string, patch: Partial<VideoSourceItem>, successMessage: string) => void;
  onSelectionChange: (selection: Selection) => void;
  selectedSourceKeySet: Set<string>;
  sources: VideoSourceItem[];
};

const VideoSourceTable = memo(function VideoSourceTable({
  operationSourceKey,
  onDeleteSource,
  onOpenEditSource,
  onSaveSourcePatch,
  onSelectionChange,
  selectedSourceKeySet,
  sources,
}: VideoSourceTableProps) {
  return (
    <Table>
      <Table.ScrollContainer className="rounded-xl">
        <Table.Content
          aria-label="视频源列表"
          className="min-w-[960px] text-sm"
          selectedKeys={selectedSourceKeySet}
          selectionMode="multiple"
          onSelectionChange={onSelectionChange}
        >
          <Table.Header>
            <Table.Column className="w-14">
              <div className="flex items-center">
                <Checkbox aria-label="选择全部视频源" slot="selection">
                  <Checkbox.Control>
                    <Checkbox.Indicator>
                      {({ isIndeterminate, isSelected }) =>
                        isIndeterminate ? (
                          <i aria-hidden="true" className="bi bi-dash" />
                        ) : isSelected ? (
                          <i aria-hidden="true" className="bi bi-check" />
                        ) : null
                      }
                    </Checkbox.Indicator>
                  </Checkbox.Control>
                </Checkbox>
              </div>
            </Table.Column>
            <Table.Column isRowHeader className="min-w-40">
              名称
            </Table.Column>
            <Table.Column className="min-w-32">KEY</Table.Column>
            <Table.Column className="min-w-20 text-center">状态</Table.Column>
            <Table.Column className="min-w-20 text-center">成人资源</Table.Column>
            <Table.Column className="min-w-20 text-center">源类型</Table.Column>
            <Table.Column className="min-w-16 text-center">权重</Table.Column>
            <Table.Column className="min-w-20 text-center">有效性</Table.Column>
            <Table.Column className="text-end">操作</Table.Column>
          </Table.Header>
          <Table.Body>
            {sources.map((source) => (
              <Table.Row key={source.key} id={source.key}>
                <Table.Cell>
                  <div className="flex min-h-10 items-center">
                    <Checkbox aria-label={`选择${source.name}`} slot="selection">
                      <Checkbox.Control>
                        <Checkbox.Indicator>
                          {({ isSelected }) =>
                            isSelected ? <i aria-hidden="true" className="bi bi-check" /> : null
                          }
                        </Checkbox.Indicator>
                      </Checkbox.Control>
                    </Checkbox>
                  </div>
                </Table.Cell>
                <Table.Cell className="min-w-40 font-medium text-foreground">{source.name}</Table.Cell>
                <Table.Cell className="min-w-32 font-mono text-xs text-default-600">{source.key}</Table.Cell>
                <Table.Cell className="min-w-20 text-center">
                  <Chip color={sourceStatusChipColorMap[source.status]} size="sm" variant="soft">
                    {sourceStatusLabelMap[source.status]}
                  </Chip>
                </Table.Cell>
                <Table.Cell className="min-w-20 text-center">
                  <Switch
                    aria-label={`切换${source.name}成人资源`}
                    isDisabled={operationSourceKey === source.key}
                    isSelected={source.adult}
                    onChange={() => onSaveSourcePatch(source.key, { adult: !source.adult }, "视频源已保存")}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </Table.Cell>
                <Table.Cell className="min-w-20 text-center">
                  <Chip color={sourceTypeChipColorMap[source.type]} size="sm" variant="soft">
                    {sourceTypeLabelMap[source.type]}
                  </Chip>
                </Table.Cell>
                <Table.Cell className="min-w-16 text-center">
                  <Chip color="accent" size="sm" variant="soft">
                    {source.weight}
                  </Chip>
                </Table.Cell>
                <Table.Cell className="min-w-20 text-center">
                  <Chip color={sourceValidityChipColorMap[source.validity]} size="sm" variant="soft">
                    <span className="inline-flex items-center gap-1.5">
                      <i aria-hidden="true" className={`bi ${sourceValidityIconMap[source.validity]}`} />
                      {sourceValidityLabelMap[source.validity]}
                    </span>
                  </Chip>
                </Table.Cell>
                <Table.Cell className="text-end">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      className={tableActionButtonClassName}
                      size="sm"
                      variant={source.status === "enabled" ? "danger-soft" : "primary"}
                      isDisabled={operationSourceKey === source.key}
                      onPress={() =>
                        onSaveSourcePatch(
                          source.key,
                          { status: source.status === "enabled" ? "disabled" : "enabled" },
                          source.status === "enabled" ? "视频源已禁用" : "视频源已启用",
                        )
                      }
                    >
                      {source.status === "enabled" ? "禁用" : "启用"}
                    </Button>
                    <Button
                      className={tableActionButtonClassName}
                      size="sm"
                      variant="secondary"
                      isDisabled={operationSourceKey === source.key}
                      onPress={() => onOpenEditSource(source)}
                    >
                      编辑
                    </Button>
                    <Button
                      className={tableActionButtonClassName}
                      size="sm"
                      variant="danger"
                      isDisabled={operationSourceKey === source.key}
                      onPress={() => onDeleteSource(source.key)}
                    >
                      删除
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}, areVideoSourceTablePropsEqual);

function areVideoSourceTablePropsEqual(previous: VideoSourceTableProps, next: VideoSourceTableProps) {
  return (
    previous.operationSourceKey === next.operationSourceKey &&
    previous.selectedSourceKeySet === next.selectedSourceKeySet &&
    previous.sources === next.sources
  );
}

export function VideoSourcePanel() {
  const editSourceModal = useOverlayState();
  const validityCheckModal = useOverlayState();
  const [sources, setSources] = useState<VideoSourceItem[]>([]);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([]);
  const [editingSource, setEditingSource] = useState<EditableVideoSource | null>(null);
  const [validityKeyword, setValidityKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [operationSourceKey, setOperationSourceKey] = useState<string | null>(null);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [isValidityChecking, setIsValidityChecking] = useState(false);

  const sourceKeys = useMemo(() => sources.map((source) => source.key), [sources]);
  const selectedSourceKeySet = useMemo(
    () => new Set(selectedSourceKeys.filter((key) => sourceKeys.includes(key))),
    [selectedSourceKeys, sourceKeys],
  );
  const selectedCount = selectedSourceKeySet.size;
  const enabledCount = sources.filter((source) => source.status === "enabled").length;

  useEffect(() => {
    let cancelled = false;

    async function loadVideoSources() {
      setIsLoading(true);

      try {
        const data = await loadVideoSourcesOnce();

        if (!cancelled) {
          setSources(data.sources);
          setSelectedSourceKeys([]);
          toast.success("视频源配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "视频源配置读取失败";
          toast.danger(message);
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
  }, []);

  const updateSourcesFromCollection = (collection: VideoSourceCollection) => {
    setSources(collection.sources);
    setSelectedSourceKeys((current) => current.filter((key) => collection.sources.some((source) => source.key === key)));
  };

  const saveSourcePatch = async (key: string, patch: Partial<VideoSourceItem>, successMessage: string) => {
    const previousSources = sources;
    setSources((current) => current.map((source) => (source.key === key ? { ...source, ...patch } : source)));
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
      toast.success(successMessage);
    } catch (error) {
      setSources(previousSources);
      const message = error instanceof Error ? error.message : "视频源保存失败";
      toast.danger(message);
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
        editSourceModal.close();
      }
      toast.success("视频源已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "视频源删除失败";
      toast.danger(message);
    } finally {
      setOperationSourceKey(null);
    }
  };

  const addSource = () => {
    setEditingSource(defaultDraft);
    editSourceModal.open();
  };

  const openValidityCheck = () => {
    setValidityKeyword(defaultValidityKeyword);
    validityCheckModal.open();
  };

  const closeValidityCheck = () => {
    if (isValidityChecking) {
      return;
    }

    setValidityKeyword("");
    validityCheckModal.close();
  };

  const runValidityCheck = async () => {
    const keyword = validityKeyword.trim();

    if (!keyword) {
      toast.danger("请输入检测关键词。");
      return;
    }

    setIsValidityChecking(true);
    setSources((current) => current.map((source) => ({ ...source, validity: "checking" })));
    validityCheckModal.close();

    try {
      const response = await fetch(`/api/admin/video-source/validity-check?keyword=${encodeURIComponent(keyword)}`, {
        headers: { Accept: "text/event-stream" },
        method: "GET",
      });

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
                current.map((source) => (source.key === result.key ? { ...source, validity: result.validity } : source)),
              );
            }
          } else if (message.event === "complete") {
            updateSourcesFromCollection(normalizeVideoSourceCollection(message.data));
          } else if (message.event === "error") {
            const raw = message.data;
            const messageText =
              raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).message === "string"
                ? String((raw as Record<string, unknown>).message)
                : "视频源有效性检测失败";
            throw new Error(messageText);
          }
        }
      }

      toast.success("视频源有效性检测完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "视频源有效性检测失败";
      toast.danger(message);
    } finally {
      setIsValidityChecking(false);
    }
  };

  const saveEditingSource = async () => {
    if (!editingSource) {
      return;
    }

    const validationMessage = validateDraft(editingSource);

    if (validationMessage) {
      toast.danger(validationMessage);
      return;
    }

    const payload = createSourcePayload(editingSource);
    setIsSaving(true);

    try {
      if (editingSource.originalKey) {
        const data = await requestJson(
          `/api/admin/video-sources/${encodeURIComponent(editingSource.originalKey)}`,
          {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          },
          "视频源保存失败",
          normalizeVideoSourceCollection,
        );
        updateSourcesFromCollection(data);
        toast.success("视频源已保存");
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
        toast.success("视频源已添加");
      }

      setEditingSource(null);
      editSourceModal.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "视频源保存失败";
      toast.danger(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSelectedSources = async (action: VideoSourceBatchAction, successMessage: string) => {
    if (selectedCount === 0) {
      return;
    }

    setIsBatchSaving(true);

    try {
      const data = await requestJson(
        "/api/admin/video-source/batch",
        {
          body: JSON.stringify({ action, keys: Array.from(selectedSourceKeySet) }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
        "批量操作失败",
        normalizeVideoSourceCollection,
      );
      updateSourcesFromCollection(data);
      toast.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量操作失败";
      toast.danger(message);
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
      toast.success("视频源已批量删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量删除失败";
      toast.danger(message);
    } finally {
      setIsBatchSaving(false);
    }
  };

  const handleTableSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      setSelectedSourceKeys(sources.map((source) => source.key));
      return;
    }

    setSelectedSourceKeys(Array.from(selection).map(String));
  };

  const openEditSource = (source: VideoSourceItem) => {
    setEditingSource(createDraftFromSource(source));
    editSourceModal.open();
  };

  const closeEditSource = () => {
    setEditingSource(null);
    editSourceModal.close();
  };

  return (
    <>
      <Card>
        <Card.Header className="flex flex-col gap-4 p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-broadcast text-2xl text-accent" />
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">视频源配置</h2>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                管理视频源基础信息、启用状态、成人资源标记、权重和检测结果。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip color="accent" variant="soft">
                {isLoading ? "加载中" : `共 ${sources.length} 个源`}
              </Chip>
              <Chip color="success" variant="soft">
                启用 {enabledCount} 个
              </Chip>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="space-y-5 p-6 pt-5 md:p-8 md:pt-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-default-200/80 bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-default-600">
              <span className="font-medium text-foreground">批量操作</span>
              <span>已选择 {selectedCount} 项</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedCount > 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={isBatchSaving}
                    onPress={() => updateSelectedSources("enable", "视频源已批量启用")}
                  >
                    批量启用
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={isBatchSaving}
                    onPress={() => updateSelectedSources("disable", "视频源已批量禁用")}
                  >
                    批量禁用
                  </Button>
                  <Button size="sm" variant="danger" isDisabled={isBatchSaving} onPress={deleteSelectedSources}>
                    批量删除
                  </Button>
                </>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                isDisabled={isLoading || sources.length === 0 || isValidityChecking}
                onPress={openValidityCheck}
              >
                {isValidityChecking ? "检测中" : "有效性检测"}
              </Button>
              <Button size="sm" variant="primary" isDisabled={isLoading} onPress={addSource}>
                添加
              </Button>
            </div>
          </div>

          <VideoSourceTable
            operationSourceKey={operationSourceKey}
            selectedSourceKeySet={selectedSourceKeySet}
            sources={sources}
            onDeleteSource={deleteSource}
            onOpenEditSource={openEditSource}
            onSaveSourcePatch={saveSourcePatch}
            onSelectionChange={handleTableSelectionChange}
          />
        </Card.Content>
      </Card>

      <Modal state={editSourceModal}>
        <Modal.Backdrop isDismissable={!isSaving}>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{editingSource?.originalKey ? "编辑视频源" : "添加视频源"}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-6">
                {editingSource ? (
                  <Form
                    id="edit-video-source-form"
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveEditingSource();
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField fullWidth name="sourceName">
                        <Label>名称</Label>
                        <Input
                          value={editingSource.name}
                          onChange={(event) =>
                            setEditingSource((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                        />
                      </TextField>

                      <TextField fullWidth name="sourceKey">
                        <Label>KEY</Label>
                        <Input
                          value={editingSource.key}
                          onChange={(event) =>
                            setEditingSource((current) =>
                              current ? { ...current, key: event.target.value } : current,
                            )
                          }
                        />
                      </TextField>

                      <TextField fullWidth name="apiUrl" className="md:col-span-2">
                        <Label>API 地址</Label>
                        <Input
                          value={editingSource.apiUrl}
                          onChange={(event) =>
                            setEditingSource((current) =>
                              current ? { ...current, apiUrl: event.target.value } : current,
                            )
                          }
                        />
                      </TextField>

                      <VideoSourceSelect
                        label="状态"
                        selectedKey={editingSource.status}
                        options={[
                          { value: "enabled", label: "启用" },
                          { value: "disabled", label: "禁用" },
                        ]}
                        onSelectionChange={(status) =>
                          setEditingSource((current) => (current ? { ...current, status } : current))
                        }
                      />

                      <VideoSourceSelect
                        label="源类型"
                        selectedKey={editingSource.type}
                        options={[
                          { value: "normal", label: "普通" },
                          { value: "short-drama", label: "短剧" },
                        ]}
                        onSelectionChange={(type) =>
                          setEditingSource((current) => (current ? { ...current, type } : current))
                        }
                      />

                      <VideoSourceSelect
                        label="成人资源"
                        selectedKey={editingSource.adult ? "yes" : "no"}
                        options={[
                          { value: "no", label: "否" },
                          { value: "yes", label: "是" },
                        ]}
                        onSelectionChange={(value) =>
                          setEditingSource((current) => (current ? { ...current, adult: value === "yes" } : current))
                        }
                      />

                      <TextField fullWidth name="sourceWeight">
                        <Label>权重</Label>
                        <Input
                          inputMode="numeric"
                          max={99}
                          min={1}
                          type="number"
                          value={String(editingSource.weight)}
                          onChange={(event) =>
                            setEditingSource((current) =>
                              current ? { ...current, weight: normalizeSourceWeight(event.target.value) } : current,
                            )
                          }
                        />
                      </TextField>
                    </div>
                  </Form>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="outline" isDisabled={isSaving} onPress={closeEditSource}>
                  取消
                </Button>
                <Button variant="primary" type="submit" form="edit-video-source-form" isDisabled={isSaving}>
                  {isSaving ? "保存中" : "保存"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={validityCheckModal}>
        <Modal.Backdrop isDismissable={!isValidityChecking}>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>有效性检测</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-6">
                <Form
                  id="validity-check-form"
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runValidityCheck();
                  }}
                >
                  <TextField fullWidth name="validityKeyword">
                    <Label>关键词</Label>
                    <Input
                      aria-label="关键词"
                      name="validityKeyword"
                      value={validityKeyword}
                      onChange={(event) => setValidityKeyword(event.target.value)}
                    />
                  </TextField>
                </Form>
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="outline" isDisabled={isValidityChecking} onPress={closeValidityCheck}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  form="validity-check-form"
                  isDisabled={isValidityChecking}
                >
                  确定
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
