"use client";

import type { Selection } from "@react-types/shared";
import { useState } from "react";
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
  useOverlayState,
} from "@heroui/react";

type VideoSourceStatus = "enabled" | "disabled";
type VideoSourceType = "normal" | "short-drama";
type VideoSourceValidity = "valid" | "warning" | "invalid";

type VideoSourceItem = {
  id: string;
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

const sourceValidityChipColorMap: Record<VideoSourceValidity, "danger" | "success" | "warning"> = {
  valid: "success",
  warning: "warning",
  invalid: "danger",
};

const tableActionButtonClassName = "h-7 px-2 text-xs";

const normalizeSourceWeight = (value: string) => {
  const weight = Number(value);

  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.min(99, Math.max(1, Math.round(weight)));
};

const defaultVideoSources: VideoSourceItem[] = [
  {
    id: "source-1",
    name: "主站聚合",
    key: "main",
    apiUrl: "https://api.example.com/vod",
    status: "enabled",
    adult: false,
    type: "normal",
    weight: 98,
    validity: "valid",
  },
  {
    id: "source-2",
    name: "短剧专线",
    key: "shorts",
    apiUrl: "https://short.example.com/api",
    status: "enabled",
    adult: false,
    type: "short-drama",
    weight: 87,
    validity: "warning",
  },
  {
    id: "source-3",
    name: "备用资源站",
    key: "backup",
    apiUrl: "https://backup.example.com/api",
    status: "disabled",
    adult: true,
    type: "normal",
    weight: 35,
    validity: "invalid",
  },
];

export function VideoSourcePanel() {
  const editSourceModal = useOverlayState();
  const [sources, setSources] = useState<VideoSourceItem[]>(defaultVideoSources);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [editingSource, setEditingSource] = useState<VideoSourceItem | null>(null);

  const sourceIds = sources.map((source) => source.id);
  const selectedSourceIdSet = new Set(selectedSourceIds.filter((id) => sourceIds.includes(id)));
  const selectedCount = selectedSourceIdSet.size;
  const enabledCount = sources.filter((source) => source.status === "enabled").length;

  const updateSource = (id: string, patch: Partial<VideoSourceItem>) => {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)));
    setEditingSource((current) => (current?.id === id ? { ...current, ...patch } : current));
  };

  const deleteSource = (id: string) => {
    setSources((current) => current.filter((source) => source.id !== id));
    setSelectedSourceIds((current) => current.filter((selectedId) => selectedId !== id));
    if (editingSource?.id === id) {
      setEditingSource(null);
      editSourceModal.close();
    }
  };

  const addSource = () => {
    const newSource: VideoSourceItem = {
      id: `source-${Date.now()}`,
      name: "新视频源",
      key: `source-${sources.length + 1}`,
      apiUrl: "",
      status: "disabled",
      adult: false,
      type: "normal",
      weight: 50,
      validity: "warning",
    };

    setSources((current) => [...current, newSource]);
    setEditingSource(newSource);
    editSourceModal.open();
  };

  const updateSelectedSources = (patch: Partial<VideoSourceItem>) => {
    if (selectedCount === 0) {
      return;
    }

    setSources((current) =>
      current.map((source) => (selectedSourceIdSet.has(source.id) ? { ...source, ...patch } : source)),
    );
  };

  const deleteSelectedSources = () => {
    if (selectedCount === 0) {
      return;
    }

    setSources((current) => current.filter((source) => !selectedSourceIdSet.has(source.id)));
    setSelectedSourceIds([]);
  };

  const handleTableSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      setSelectedSourceIds(sources.map((source) => source.id));
      return;
    }

    setSelectedSourceIds(Array.from(selection).map(String));
  };

  const openEditSource = (source: VideoSourceItem) => {
    setEditingSource(source);
    editSourceModal.open();
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
                共 {sources.length} 个源
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
                  <Button size="sm" variant="secondary" onPress={() => updateSelectedSources({ status: "enabled" })}>
                    批量启用
                  </Button>
                  <Button size="sm" variant="secondary" onPress={() => updateSelectedSources({ status: "disabled" })}>
                    批量禁用
                  </Button>
                  <Button size="sm" variant="danger" onPress={deleteSelectedSources}>
                    批量删除
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="primary" onPress={addSource}>
                添加
              </Button>
            </div>
          </div>

          <Table>
            <Table.ScrollContainer className="rounded-xl">
              <Table.Content
                aria-label="视频源列表"
                className="min-w-[960px] text-sm"
                selectedKeys={selectedSourceIdSet}
                selectionMode="multiple"
                onSelectionChange={handleTableSelectionChange}
              >
                <Table.Header>
                  <Table.Column className="w-14">
                    <div className="flex items-center">
                      <Checkbox
                        aria-label="选择全部视频源"
                        slot="selection"
                      >
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
                    <Table.Row key={source.id} id={source.id}>
                      <Table.Cell>
                        <div className="flex min-h-10 items-center">
                          <Checkbox
                            aria-label={`选择${source.name}`}
                            slot="selection"
                          >
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
                          isSelected={source.adult}
                          onChange={() => updateSource(source.id, { adult: !source.adult })}
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
                          {sourceValidityLabelMap[source.validity]}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            className={tableActionButtonClassName}
                            size="sm"
                            variant="secondary"
                            onPress={() => openEditSource(source)}
                          >
                            编辑
                          </Button>
                          <Button
                            className={tableActionButtonClassName}
                            size="sm"
                            variant="danger"
                            onPress={() => deleteSource(source.id)}
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
        </Card.Content>
      </Card>

      <Modal state={editSourceModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>编辑视频源</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-6">
                {editingSource ? (
                  <Form
                    id="edit-video-source-form"
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      editSourceModal.close();
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField fullWidth name="sourceName">
                        <Label>名称</Label>
                        <Input
                          value={editingSource.name}
                          onChange={(event) => updateSource(editingSource.id, { name: event.target.value })}
                        />
                      </TextField>

                      <TextField fullWidth name="sourceKey">
                        <Label>KEY</Label>
                        <Input
                          value={editingSource.key}
                          onChange={(event) => updateSource(editingSource.id, { key: event.target.value })}
                        />
                      </TextField>

                      <TextField fullWidth name="apiUrl" className="md:col-span-2">
                        <Label>API 地址</Label>
                        <Input
                          value={editingSource.apiUrl}
                          onChange={(event) => updateSource(editingSource.id, { apiUrl: event.target.value })}
                        />
                      </TextField>

                      <Select
                        fullWidth
                        selectedKey={editingSource.status}
                        onSelectionChange={(key) => {
                          if (key != null) {
                            updateSource(editingSource.id, { status: String(key) as VideoSourceStatus });
                          }
                        }}
                      >
                        <Label>状态</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox className="bg-[var(--layout-panel-background)]">
                            <ListBox.Item id="enabled" key="enabled" textValue="启用">
                              启用
                            </ListBox.Item>
                            <ListBox.Item id="disabled" key="disabled" textValue="禁用">
                              禁用
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <Select
                        fullWidth
                        selectedKey={editingSource.type}
                        onSelectionChange={(key) => {
                          if (key != null) {
                            updateSource(editingSource.id, { type: String(key) as VideoSourceType });
                          }
                        }}
                      >
                        <Label>源类型</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox className="bg-[var(--layout-panel-background)]">
                            <ListBox.Item id="normal" key="normal" textValue="普通">
                              普通
                            </ListBox.Item>
                            <ListBox.Item id="short-drama" key="short-drama" textValue="短剧">
                              短剧
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <Select
                        fullWidth
                        selectedKey={editingSource.adult ? "yes" : "no"}
                        onSelectionChange={(key) => {
                          if (key != null) {
                            updateSource(editingSource.id, { adult: key === "yes" });
                          }
                        }}
                      >
                        <Label>成人资源</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox className="bg-[var(--layout-panel-background)]">
                            <ListBox.Item id="no" key="no" textValue="否">
                              否
                            </ListBox.Item>
                            <ListBox.Item id="yes" key="yes" textValue="是">
                              是
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <TextField fullWidth name="sourceWeight">
                        <Label>权重</Label>
                        <Input
                          inputMode="numeric"
                          max={99}
                          min={1}
                          type="number"
                          value={String(editingSource.weight)}
                          onChange={(event) =>
                            updateSource(editingSource.id, { weight: normalizeSourceWeight(event.target.value) })
                          }
                        />
                      </TextField>
                    </div>
                  </Form>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="outline" onPress={editSourceModal.close}>
                  取消
                </Button>
                <Button variant="primary" type="submit" form="edit-video-source-form">
                  保存
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
