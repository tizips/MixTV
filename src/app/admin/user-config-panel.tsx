"use client";

import { useState } from "react";
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
  useOverlayState,
} from "@heroui/react";

type UserRole = "owner" | "user";
type UserStatus = "active" | "banned";

type UserItem = {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
};

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

export function UserConfigPanel() {
  const addUserModal = useOverlayState();
  const [users, setUsers] = useState<UserItem[]>([
    { id: "u-1", username: "admin", role: "owner", status: "active" },
    { id: "u-2", username: "alice", role: "user", status: "active" },
    { id: "u-3", username: "bob", role: "user", status: "banned" },
  ]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newStatus, setNewStatus] = useState<UserStatus>("active");
  const [formError, setFormError] = useState("");
  const activeUserCount = users.filter((user) => user.status === "active").length;
  const bannedUserCount = users.filter((user) => user.status === "banned").length;
  const ownerCount = users.filter((user) => user.role === "owner").length;

  const resetForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewRole("user");
    setNewStatus("active");
    setFormError("");
  };

  const handleAddUser = () => {
    if (!newUsername.trim()) {
      setFormError("请输入用户名。");
      return false;
    }

    if (!newPassword) {
      setFormError("请输入初始密码。");
      return false;
    }

    if (newPassword !== newPasswordConfirm) {
      setFormError("两次输入的密码不一致。");
      return false;
    }

    setUsers((current) => [
      ...current,
      {
        id: `u-${Date.now()}`,
        username: newUsername.trim(),
        role: newRole,
        status: newStatus,
      },
    ]);
    resetForm();
    return true;
  };

  const updateUser = (id: string, patch: Partial<UserItem>) => {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  };

  const deleteUser = (id: string) => {
    setUsers((current) => current.filter((user) => user.id !== id));
  };

  return (
    <>
      <Card className="bg-background/70" variant="secondary">
        <Card.Header className="p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex items-center gap-3">
            <i aria-hidden="true" className="bi bi-people text-2xl text-amber-300" />
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">用户配置</h2>
          </div>
        </Card.Header>

        <Card.Content className="space-y-6 pb-0 md:p-8">
          <Card variant="transparent" className="p-1">
            <Card.Header className="p-0">
              <div className="flex items-center gap-3">
                <i aria-hidden="true" className="bi bi-bar-chart text-xl text-amber-300" />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">用户统计</h3>
              </div>
            </Card.Header>
            <Card.Content>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Alert.Title className="text-2xl font-semibold tracking-tight">{users.length}</Alert.Title>
                    <Alert.Description>用户总数</Alert.Description>
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
                <i aria-hidden="true" className="bi bi-list-ul text-xl text-amber-300" />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">用户列表</h3>
              </div>

              <Button variant="primary" onPress={addUserModal.open}>
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
                        <Table.Row key={user.id} id={user.id}>
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
                              <Button className={tableActionButtonClassName} size="sm" variant="secondary">
                                修改密码
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                size="sm"
                                variant="secondary"
                                onPress={() =>
                                  updateUser(user.id, { role: user.role === "owner" ? "user" : "owner" })
                                }
                              >
                                设为管理
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                size="sm"
                                variant={user.status === "active" ? "danger-soft" : "secondary"}
                                onPress={() =>
                                  updateUser(user.id, {
                                    status: user.status === "active" ? "banned" : "active",
                                  })
                                }
                              >
                                封禁
                              </Button>
                              <Button
                                className={tableActionButtonClassName}
                                size="sm"
                                variant="danger"
                                onPress={() => deleteUser(user.id)}
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
        <Modal.Backdrop>
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
                    if (handleAddUser()) {
                      addUserModal.close();
                    }
                  }}
                >
                  <div className="space-y-4">
                    <TextField fullWidth name="username">
                      <Label>用户名</Label>
                      <Input
                        autoComplete="username"
                        placeholder="请输入用户名"
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
                        value={newPasswordConfirm}
                        onChange={(event) => {
                          setNewPasswordConfirm(event.target.value);
                          setFormError("");
                        }}
                      />
                    </TextField>

                    <Select
                      fullWidth
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
                        <ListBox>
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
                        <ListBox>
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
                <Button variant="outline" onPress={addUserModal.close}>
                  取消
                </Button>
                <Button variant="primary" type="submit" form="add-user-form">
                  添加
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
