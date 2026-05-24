"use client";

import {
  BarChartOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  PlusOutlined,
  StopOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  usernamePattern,
  usernamePatternMessage,
  userPasswordPattern,
  userPasswordPatternMessage,
} from "@/shared/user-credentials";

type UserRole = "owner" | "user";
type UserStatus = "active" | "banned";

type UserItem = {
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string | null;
};

type UserCollectionResponse = {
  users: UserItem[];
  updatedAt: string | null;
};

type AddUserFormValues = {
  password: string;
  passwordConfirm: string;
  role: UserRole;
  status: UserStatus;
  username: string;
};

type PasswordFormValues = {
  username: string;
  password: string;
  passwordConfirm: string;
};

const roleLabelMap: Record<UserRole, string> = {
  owner: "站长",
  user: "普通用户",
};

const statusLabelMap: Record<UserStatus, string> = {
  active: "正常",
  banned: "封禁",
};

const defaultUsers: UserItem[] = [
  { username: "admin", role: "owner", status: "active" },
  { username: "alice", role: "user", status: "active" },
  { username: "bob", role: "user", status: "banned" },
];

function isUserRole(value: unknown): value is UserRole {
  return value === "owner" || value === "user";
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "active" || value === "banned";
}

function normalizeUserItem(payload: unknown): UserItem | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const raw = payload as Record<string, unknown>;

  if (
    typeof raw.username !== "string" ||
    !isUserRole(raw.role) ||
    !isUserStatus(raw.status)
  ) {
    return null;
  }

  return {
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    role: raw.role,
    status: raw.status,
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : undefined,
    username: raw.username,
  };
}

function normalizeUserCollectionResponse(
  payload: unknown,
): UserCollectionResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const parsedUsers = Array.isArray(raw.users)
    ? raw.users.map(normalizeUserItem).filter((user) => user !== null)
    : null;

  return {
    updatedAt:
      typeof raw.updatedAt === "string" || raw.updatedAt === null
        ? raw.updatedAt
        : null,
    users: parsedUsers ?? defaultUsers,
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

let usersLoadRequest: Promise<UserCollectionResponse> | null = null;

export function resetUserConfigPanelState() {
  usersLoadRequest = null;
}

async function fetchUsers() {
  const response = await fetch("/api/admin/users");

  if (!response.ok) {
    throw new Error("用户配置读取失败");
  }

  return normalizeUserCollectionResponse(await response.json());
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

function loadUsersOnce() {
  if (usersLoadRequest) {
    return usersLoadRequest;
  }

  const request = fetchUsers();
  usersLoadRequest = request;

  void request
    .finally(() => {
      if (usersLoadRequest === request) {
        usersLoadRequest = null;
      }
    })
    .catch(() => undefined);

  return request;
}

function getUserApiPath(username: string) {
  return `/api/admin/users/${encodeURIComponent(username)}`;
}

export function UserConfigPanel() {
  const { message: msg } = App.useApp();
  const [addUserForm] = Form.useForm<AddUserFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [users, setUsers] = useState<UserItem[]>(defaultUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUsername, setSavingUsername] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const activeUserCount = users.filter(
    (user) => user.status === "active",
  ).length;
  const bannedUserCount = users.filter(
    (user) => user.status === "banned",
  ).length;
  const ownerCount = users.filter((user) => user.role === "owner").length;
  const userTotal = users.length;
  const activeUserPercent =
    userTotal > 0 ? Math.round((activeUserCount / userTotal) * 100) : 0;
  const bannedUserPercent =
    userTotal > 0 ? Math.round((bannedUserCount / userTotal) * 100) : 0;
  const ownerPercent =
    userTotal > 0 ? Math.round((ownerCount / userTotal) * 100) : 0;
  const statItems = [
    {
      icon: <CheckCircleOutlined />,
      label: "正常",
      helper: "可正常访问",
      progressClassName: "bg-accent",
      value: activeUserCount,
      width: activeUserPercent,
    },
    {
      icon: <StopOutlined />,
      label: "封禁",
      helper: "已限制访问",
      progressClassName: "bg-red-500",
      value: bannedUserCount,
      width: bannedUserPercent,
    },
    {
      icon: <CrownOutlined />,
      label: "站长",
      helper: "拥有管理权限",
      value: ownerCount,
      progressClassName: "bg-amber-500",
      width: ownerPercent,
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);

      try {
        const data = await loadUsersOnce();

        if (!cancelled) {
          setUsers(data.users);
          setLastUpdated(data.updatedAt);
          msg.success("用户配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "用户配置读取失败";
          msg.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [msg]);

  const resetForm = () => {
    addUserForm.setFieldsValue({
      password: "",
      passwordConfirm: "",
      role: "user",
      status: "active",
      username: "",
    });
  };

  const openAddUserModal = () => {
    resetForm();
    setIsAddUserOpen(true);
  };

  const closeAddUserModal = () => {
    resetForm();
    setIsAddUserOpen(false);
  };

  const resetPasswordForm = (username?: string) => {
    passwordForm.setFieldsValue({
      username,
      password: "",
      passwordConfirm: "",
    });
  };

  const openPasswordModal = (username: string) => {
    passwordForm.setFieldsValue({
      username: username,
      password: "",
      passwordConfirm: "",
    });
    setIsPasswordOpen(true);
  };

  const closePasswordModal = () => {
    resetPasswordForm();
    setIsPasswordOpen(false);
  };

  const handleAddUser = async (values: AddUserFormValues) => {
    const username = values.username.trim();
    const password = values.password.trim();

    try {
      const response = await fetch("/api/admin/user", {
        body: JSON.stringify({
          password,
          role: values.role,
          status: values.status,
          username,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "用户创建失败"));
      }

      const created = normalizeUserItem(await response.json());

      if (!created) {
        throw new Error("用户创建响应无效");
      }

      setUsers((current) => [
        ...current.filter((user) => user.username !== created.username),
        created,
      ]);
      msg.success("用户已添加");
      resetForm();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "用户创建失败";
      msg.error(message);
      return false;
    } finally {
      setSavingUsername(null);
    }
  };

  const updateUser = async (username: string, patch: Partial<UserItem>) => {
    const previousUsers = users;

    setUsers((current) =>
      current.map((user) =>
        user.username === username ? { ...user, ...patch } : user,
      ),
    );
    setSavingUsername(username);

    try {
      const response = await fetch(getUserApiPath(username), {
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "用户配置保存失败"),
        );
      }

      const data = normalizeUserCollectionResponse(await response.json());
      setUsers(data.users);
      setLastUpdated(data.updatedAt);
      msg.success("用户配置已保存");
    } catch (error) {
      setUsers(previousUsers);
      const message =
        error instanceof Error ? error.message : "用户配置保存失败";
      msg.error(message);
    } finally {
      setSavingUsername(null);
    }
  };

  const updatePassword = async (values: PasswordFormValues) => {
    const password = values.password.trim();
    const username = values.username.trim();

    try {
      const response = await fetch(getUserApiPath(username), {
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "用户密码修改失败"),
        );
      }

      msg.success("用户密码已修改");
      resetPasswordForm();
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "用户密码修改失败";
      msg.error(message);
      return false;
    } finally {
      setSavingUsername(null);
    }
  };

  const deleteUser = async (username: string) => {
    if (!window.confirm(`确定删除用户 ${username} 吗？此操作无法撤销。`)) {
      return;
    }

    const previousUsers = users;

    setUsers((current) => current.filter((user) => user.username !== username));
    setSavingUsername(username);

    try {
      const response = await fetch(getUserApiPath(username), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "用户删除失败"));
      }

      const data = normalizeUserCollectionResponse(await response.json());
      setUsers(data.users);
      setLastUpdated(data.updatedAt);
      msg.success("用户已删除");
    } catch (error) {
      setUsers(previousUsers);
      const message = error instanceof Error ? error.message : "用户删除失败";
      msg.error(message);
    } finally {
      setSavingUsername(null);
    }
  };

  const columns: ColumnsType<UserItem> = [
    {
      dataIndex: "username",
      title: "用户名",
    },
    {
      dataIndex: "role",
      title: "角色",
      render: (role: UserRole) => (
        <Tag color={role === "owner" ? "processing" : "default"}>
          {roleLabelMap[role]}
        </Tag>
      ),
    },
    {
      dataIndex: "status",
      title: "状态",
      render: (status: UserStatus) => (
        <Tag color={status === "active" ? "success" : "error"}>
          {statusLabelMap[status]}
        </Tag>
      ),
    },
    {
      align: "right",
      key: "actions",
      title: "操作",
      render: (_, user) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            disabled={savingUsername === user.username}
            size="small"
            onClick={() => openPasswordModal(user.username)}
          >
            修改密码
          </Button>
          <Button
            disabled={savingUsername === user.username}
            size="small"
            type="default"
            onClick={() =>
              void updateUser(user.username, {
                role: user.role === "owner" ? "user" : "owner",
              })
            }
          >
            {user.role === "owner" ? "设为普通" : "设为管理"}
          </Button>
          <Button
            disabled={savingUsername === user.username}
            size="small"
            danger={user.status === "active"}
            onClick={() =>
              void updateUser(user.username, {
                status: user.status === "active" ? "banned" : "active",
              })
            }
          >
            {user.status === "active" ? "封禁" : "解封"}
          </Button>
          <Button
            danger
            disabled={savingUsername === user.username}
            size="small"
            onClick={() => void deleteUser(user.username)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="relative">
        <Card loading={isLoading}>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <TeamOutlined className="text-2xl text-accent" />
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      用户配置
                    </h2>
                  </div>
                </div>
                <p className="max-w-3xl text-sm leading-7 text-default-600 md:text-base">
                  管理用户账号、角色、状态和密码，列表操作会立即写入用户配置接口。
                </p>
              </div>

              <Tag color={isLoading ? "processing" : "success"}>
                {isLoading ? "加载中" : `用户 ${users.length} 位`}
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
                    用户统计
                  </p>
                  <p className="mt-1 text-xs leading-5 text-default-500">
                    当前账号、角色和访问状态概览。
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
                      Total users
                    </p>
                    <p className="mt-2 text-4xl font-semibold text-foreground">
                      {userTotal}
                    </p>
                    <p className="mt-2 text-sm text-default-500">用户总数</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <UserOutlined className="text-lg" />
                  </span>
                </div>

                <div
                  className="mt-5 flex h-2 overflow-hidden rounded-full bg-surface-secondary"
                  aria-label={`正常用户 ${activeUserPercent}%，封禁用户 ${bannedUserPercent}%`}
                >
                  <div
                    className="bg-accent"
                    style={{ width: `${activeUserPercent}%` }}
                  />
                  <div
                    className="bg-danger"
                    style={{ width: `${bannedUserPercent}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-default-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    正常 {activeUserPercent}%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    封禁 {bannedUserPercent}%
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
              <div className="flex items-center gap-3">
                <BarsOutlined className="text-xl text-accent" />
                <p className="text-sm font-medium text-foreground mb-0!">
                  用户列表
                </p>
              </div>

              <Button type="primary" onClick={openAddUserModal}>
                <PlusOutlined />
                添加用户
              </Button>
            </div>

            <div>
              <Table<UserItem>
                columns={columns}
                dataSource={users}
                pagination={false}
                rowKey="username"
                bordered
              />
            </div>
          </div>
        </Card>
      </div>
      <Modal
        title="添加用户"
        open={isAddUserOpen}
        onCancel={closeAddUserModal}
        onOk={addUserForm.submit}
      >
        <Divider />
        <Form<AddUserFormValues>
          form={addUserForm}
          layout="vertical"
          onFinish={(values) => {
            void handleAddUser(values).then((saved) => {
              if (saved) {
                closeAddUserModal();
              }
            });
          }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              {
                validator: async (_, value: string) => {
                  if (!usernamePattern.test(value)) {
                    throw new Error(usernamePatternMessage);
                  }
                },
              },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            label="初始密码"
            name="password"
            rules={[
              {
                validator: async (_, value: string) => {
                  if (!userPasswordPattern.test(value)) {
                    throw new Error(userPasswordPatternMessage);
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder="请输入初始密码" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="passwordConfirm"
            rules={[
              {
                validator: async (_, value: string) => {
                  const passwordConfirm = value;
                  const password = addUserForm.getFieldValue("password");

                  if (!passwordConfirm) {
                    throw new Error("请再次输入初始密码。");
                  }

                  if (passwordConfirm !== password) {
                    throw new Error("两次输入的密码不一致。");
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder="请再次输入初始密码" />
          </Form.Item>
          <Form.Item label="角色" name="role">
            <Select
              className="w-full"
              options={[
                { label: "站长", value: "owner" },
                { label: "普通用户", value: "user" },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              className="w-full"
              options={[
                { label: "正常", value: "active" },
                { label: "封禁", value: "banned" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="修改密码"
        open={isPasswordOpen}
        onCancel={closePasswordModal}
        onOk={passwordForm.submit}
      >
        <Divider />
        <Form<PasswordFormValues>
          form={passwordForm}
          layout="vertical"
          onFinish={(values) => {
            void updatePassword(values).then((saved) => {
              if (saved) {
                closePasswordModal();
              }
            });
          }}
        >
          <Form.Item label="用户名" name="username">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              {
                validator: async (_, value: string) => {
                  if (!userPasswordPattern.test(value)) {
                    throw new Error(userPasswordPatternMessage);
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="passwordConfirm"
            rules={[
              {
                validator: async (_, value: string) => {
                  const password = passwordForm.getFieldValue("password");

                  if (!value) {
                    throw new Error("请再次输入新密码。");
                  }

                  if (value !== password) {
                    throw new Error("两次输入的密码不一致。");
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
