"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Alert,
  Button,
  Card,
  Chip,
  ErrorMessage,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextField,
  toast,
  useOverlayState,
} from "@heroui/react";
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

const addUserSchema = z
  .object({
    password: z.string().trim().regex(userPasswordPattern, userPasswordPatternMessage),
    passwordConfirm: z.string().min(1, "请再次输入初始密码。"),
    role: z.enum(["owner", "user"]),
    status: z.enum(["active", "banned"]),
    username: z.string().trim().regex(usernamePattern, usernamePatternMessage),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "两次输入的密码不一致。",
    path: ["passwordConfirm"],
  });

const passwordSchema = z
  .object({
    password: z.string().trim().regex(userPasswordPattern, userPasswordPatternMessage),
    passwordConfirm: z.string().min(1, "请再次输入新密码。"),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "两次输入的密码不一致。",
    path: ["passwordConfirm"],
  });

const roleLabelMap: Record<UserRole, string> = {
  owner: "站长",
  user: "普通用户",
};

const statusLabelMap: Record<UserStatus, string> = {
  active: "正常",
  banned: "封禁",
};

const roleChipColorMap: Record<UserRole, "accent" | "default"> = {
  owner: "accent",
  user: "default",
};

const statusChipColorMap: Record<UserStatus, "danger" | "success"> = {
  active: "success",
  banned: "danger",
};

const tableActionButtonClassName = "h-7 px-2 text-xs";

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

  if (typeof raw.username !== "string" || !isUserRole(raw.role) || !isUserStatus(raw.status)) {
    return null;
  }

  return {
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    role: raw.role,
    status: raw.status,
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : undefined,
    username: raw.username,
  };
}

function normalizeUserCollectionResponse(payload: unknown): UserCollectionResponse {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const parsedUsers = Array.isArray(raw.users) ? raw.users.map(normalizeUserItem).filter((user) => user !== null) : null;

  return {
    updatedAt: typeof raw.updatedAt === "string" || raw.updatedAt === null ? raw.updatedAt : null,
    users: parsedUsers ?? defaultUsers,
  };
}

function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "表单校验失败。";
}

let usersLoadRequest: Promise<UserCollectionResponse> | null = null;

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
  const addUserModal = useOverlayState();
  const passwordModal = useOverlayState();
  const [users, setUsers] = useState<UserItem[]>(defaultUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUsername, setSavingUsername] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newStatus, setNewStatus] = useState<UserStatus>("active");
  const [formError, setFormError] = useState("");
  const [passwordUsername, setPasswordUsername] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirmValue, setPasswordConfirmValue] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const activeUserCount = users.filter((user) => user.status === "active").length;
  const bannedUserCount = users.filter((user) => user.status === "banned").length;
  const ownerCount = users.filter((user) => user.role === "owner").length;

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);

      try {
        const data = await loadUsersOnce();

        if (!cancelled) {
          setUsers(data.users);
          toast.success("用户配置已加载");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "用户配置读取失败";
          toast.danger(message);
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
  }, []);

  const resetForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewRole("user");
    setNewStatus("active");
    setFormError("");
  };

  const openAddUserModal = () => {
    resetForm();
    addUserModal.open();
  };

  const closeAddUserModal = () => {
    resetForm();
    addUserModal.close();
  };

  const resetPasswordForm = () => {
    setPasswordUsername("");
    setPasswordValue("");
    setPasswordConfirmValue("");
    setPasswordError("");
  };

  const openPasswordModal = (username: string) => {
    setPasswordUsername(username);
    setPasswordValue("");
    setPasswordConfirmValue("");
    setPasswordError("");
    passwordModal.open();
  };

  const closePasswordModal = () => {
    resetPasswordForm();
    passwordModal.close();
  };

  const handleAddUser = async () => {
    const parsed = addUserSchema.safeParse({
      password: newPassword,
      passwordConfirm: newPasswordConfirm,
      role: newRole,
      status: newStatus,
      username: newUsername,
    });

    if (!parsed.success) {
      setFormError(getZodErrorMessage(parsed.error));
      return false;
    }

    setFormError("");
    setSavingUsername(parsed.data.username);

    try {
      const response = await fetch("/api/admin/user", {
        body: JSON.stringify({
          password: parsed.data.password,
          role: parsed.data.role,
          status: parsed.data.status,
          username: parsed.data.username,
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

      setUsers((current) => [...current.filter((user) => user.username !== created.username), created]);
      toast.success("用户已添加");
      resetForm();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "用户创建失败";
      toast.danger(message);
      return false;
    } finally {
      setSavingUsername(null);
    }
  };

  const updateUser = async (username: string, patch: Partial<UserItem>) => {
    const previousUsers = users;

    setUsers((current) => current.map((user) => (user.username === username ? { ...user, ...patch } : user)));
    setSavingUsername(username);

    try {
      const response = await fetch(getUserApiPath(username), {
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "用户配置保存失败"));
      }

      setUsers(normalizeUserCollectionResponse(await response.json()).users);
      toast.success("用户配置已保存");
    } catch (error) {
      setUsers(previousUsers);
      const message = error instanceof Error ? error.message : "用户配置保存失败";
      toast.danger(message);
    } finally {
      setSavingUsername(null);
    }
  };

  const updatePassword = async () => {
    const parsed = passwordSchema.safeParse({
      password: passwordValue,
      passwordConfirm: passwordConfirmValue,
    });

    if (!parsed.success) {
      setPasswordError(getZodErrorMessage(parsed.error));
      return false;
    }

    setPasswordError("");
    setSavingUsername(passwordUsername);

    try {
      const response = await fetch(getUserApiPath(passwordUsername), {
        body: JSON.stringify({ password: parsed.data.password }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "用户密码修改失败"));
      }

      setUsers(normalizeUserCollectionResponse(await response.json()).users);
      toast.success("用户密码已修改");
      resetPasswordForm();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "用户密码修改失败";
      setPasswordError(message);
      toast.danger(message);
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

      setUsers(normalizeUserCollectionResponse(await response.json()).users);
      toast.success("用户已删除");
    } catch (error) {
      setUsers(previousUsers);
      const message = error instanceof Error ? error.message : "用户删除失败";
      toast.danger(message);
    } finally {
      setSavingUsername(null);
    }
  };

  return (
    <>
      <Card>
        <Card.Header className="p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex items-center gap-3">
            <i aria-hidden="true" className="bi bi-people text-2xl text-accent" />
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">用户配置</h2>
          </div>
        </Card.Header>

        <Card.Content className="space-y-6 pb-0 md:p-8">
          <Card variant="transparent" className="p-1">
            <Card.Header className="p-0">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-bar-chart text-xl text-accent" />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">用户统计</h3>
              </div>
            </Card.Header>
            <Card.Content>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Alert.Title className="text-2xl font-semibold tracking-tight">{users.length}</Alert.Title>
                    <Alert.Description>{isLoading ? "正在同步用户配置" : "用户总数"}</Alert.Description>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm sm:min-w-80">
                    <div>
                      <p className="font-semibold text-foreground">{activeUserCount}</p>
                      <p className="text-default-500">正常</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{bannedUserCount}</p>
                      <p className="text-default-500">封禁</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{ownerCount}</p>
                      <p className="text-default-500">站长</p>
                    </div>
                  </div>
                </Alert.Content>
              </Alert>
            </Card.Content>
          </Card>

          <Card variant="transparent" className="p-1">
            <Card.Header className="flex flex-col gap-4 pb-0 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-list-ul text-xl text-accent" />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">用户列表</h3>
              </div>

              <Button variant="primary" onPress={openAddUserModal}>
                <i aria-hidden="true" className="bi bi-plus-lg" />
                添加用户
              </Button>
            </Card.Header>

            <Card.Content>
              <Table>
                <Table.ScrollContainer className="rounded-xl">
                  <Table.Content aria-label="用户列表" className="min-w-full text-sm">
                    <Table.Header>
                      <Table.Column isRowHeader>用户名</Table.Column>
                      <Table.Column>角色</Table.Column>
                      <Table.Column>状态</Table.Column>
                      <Table.Column className="text-end">操作</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {users.map((user) => (
                        <Table.Row key={user.username} id={user.username}>
                          <Table.Cell className="text-foreground">{user.username}</Table.Cell>
                          <Table.Cell>
                            <Chip color={roleChipColorMap[user.role]} size="sm" variant="soft">
                              {roleLabelMap[user.role]}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip color={statusChipColorMap[user.status]} size="sm" variant="soft">
                              {statusLabelMap[user.status]}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="text-end">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                className={tableActionButtonClassName}
                                isDisabled={savingUsername === user.username}
                                size="sm"
                                variant="secondary"
                                onPress={() => openPasswordModal(user.username)}
                              >
                                修改密码
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                isDisabled={savingUsername === user.username}
                                size="sm"
                                variant={user.role === "owner" ? "secondary" : "danger-soft"}
                                onPress={() =>
                                  void updateUser(user.username, { role: user.role === "owner" ? "user" : "owner" })
                                }
                              >
                                {user.role === "owner" ? "设为普通" : "设为管理"}
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                isDisabled={savingUsername === user.username}
                                size="sm"
                                variant={user.status === "active" ? "danger-soft" : "secondary"}
                                onPress={() =>
                                  void updateUser(user.username, {
                                    status: user.status === "active" ? "banned" : "active",
                                  })
                                }
                              >
                                {user.status === "active" ? "封禁" : "解封"}
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                isDisabled={savingUsername === user.username}
                                size="sm"
                                variant="danger"
                                onPress={() => void deleteUser(user.username)}
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
        </Card.Content>
      </Card>
      <Modal state={addUserModal}>
        <Modal.Backdrop isDismissable={false}>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>添加用户</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-6">
                <Form
                  id="add-user-form"
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddUser().then((saved) => {
                      if (saved) {
                        addUserModal.close();
                      }
                    });
                  }}
                >
                  <div className="space-y-4">
                    <TextField fullWidth name="username">
                      <Label>用户名</Label>
                      <Input
                        autoComplete="username"
                        placeholder="请输入用户名"
                        variant="secondary"
                        value={newUsername}
                        onChange={(event) => {
                          setNewUsername(event.target.value);
                          setFormError("");
                        }}
                      />
                    </TextField>

                    <TextField fullWidth name="password">
                      <Label>初始密码</Label>
                      <Input
                        autoComplete="new-password"
                        placeholder="请输入初始密码"
                        type="password"
                        variant="secondary"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setFormError("");
                        }}
                      />
                    </TextField>

                    <TextField fullWidth name="passwordConfirm">
                      <Label>确认密码</Label>
                      <Input
                        autoComplete="new-password"
                        placeholder="请再次输入初始密码"
                        type="password"
                        variant="secondary"
                        value={newPasswordConfirm}
                        onChange={(event) => {
                          setNewPasswordConfirm(event.target.value);
                          setFormError("");
                        }}
                      />
                    </TextField>

                    <Select
                      fullWidth
                      variant="secondary"
                      selectedKey={newRole}
                      onSelectionChange={(key) => {
                        if (key != null) {
                          setNewRole(String(key) as UserRole);
                        }
                      }}
                    >
                      <Label>角色</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox className="bg-[var(--surface)]">
                          <ListBox.Item id="owner" key="owner" textValue="站长">
                            站长
                          </ListBox.Item>
                          <ListBox.Item id="user" key="user" textValue="普通用户">
                            普通用户
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    <Select
                      fullWidth
                      variant="secondary"
                      selectedKey={newStatus}
                      onSelectionChange={(key) => {
                        if (key != null) {
                          setNewStatus(String(key) as UserStatus);
                        }
                      }}
                    >
                      <Label>状态</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox className="bg-[var(--surface)]">
                          <ListBox.Item id="active" key="active" textValue="正常">
                            正常
                          </ListBox.Item>
                          <ListBox.Item id="banned" key="banned" textValue="封禁">
                            封禁
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    {formError ? <ErrorMessage>{formError}</ErrorMessage> : null}
                  </div>
                </Form>
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="outline" isDisabled={savingUsername !== null} onPress={closeAddUserModal}>
                  取消
                </Button>
                <Button variant="primary" type="submit" form="add-user-form" isDisabled={savingUsername !== null}>
                  添加
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal state={passwordModal}>
        <Modal.Backdrop isDismissable={false}>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>修改密码</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-6">
                <Form
                  id="change-password-form"
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void updatePassword().then((saved) => {
                      if (saved) {
                        passwordModal.close();
                      }
                    });
                  }}
                >
                  <div className="space-y-4">
                    <TextField fullWidth name="passwordUsername">
                      <Label>用户名</Label>
                      <Input readOnly variant="secondary" value={passwordUsername} />
                    </TextField>

                    <TextField fullWidth name="password">
                      <Label>新密码</Label>
                      <Input
                        autoComplete="new-password"
                        placeholder="请输入新密码"
                        type="password"
                        variant="secondary"
                        value={passwordValue}
                        onChange={(event) => {
                          setPasswordValue(event.target.value);
                          setPasswordError("");
                        }}
                      />
                    </TextField>

                    <TextField fullWidth name="passwordConfirm">
                      <Label>确认新密码</Label>
                      <Input
                        autoComplete="new-password"
                        placeholder="请再次输入新密码"
                        type="password"
                        variant="secondary"
                        value={passwordConfirmValue}
                        onChange={(event) => {
                          setPasswordConfirmValue(event.target.value);
                          setPasswordError("");
                        }}
                      />
                    </TextField>

                    {passwordError ? <ErrorMessage>{passwordError}</ErrorMessage> : null}
                  </div>
                </Form>
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="outline" isDisabled={savingUsername !== null} onPress={closePasswordModal}>
                  取消
                </Button>
                <Button variant="primary" type="submit" form="change-password-form" isDisabled={savingUsername !== null}>
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
