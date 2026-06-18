"use client";

import { ApiOutlined, StarFilled } from "@ant-design/icons";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { App, Button, Card, Col, Form, Input, Row, Typography } from "antd";
import { env } from "@/shared/env";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const router = useRouter();

  const onSubmit = (values: { username?: string; password?: string }) => {
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const result = await signIn("credentials", {
          password: values.password,
          redirect: false,
          redirectTo: "/",
          username: values.username,
        });

        if (result?.error || !result?.ok) {
          setError("Incorrect username or password.");
          return;
        }

        message.success("登录成功");
        router.replace("/");
        router.refresh();
      } catch {
        setError("Unable to sign in right now. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <section className="fixed inset-0 z-80 overflow-auto bg-background px-4 py-12 md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-6xl items-center justify-center">
        <Card className="w-full max-w-5xl overflow-hidden border border-default-200 bg-surface shadow-lg dark:border-default-700">
          <Row gutter={0} align="stretch">
            <Col className="hidden md:block" md={12}>
              <div className="flex h-full flex-col justify-between bg-surface-secondary p-10">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                    <ApiOutlined />
                    Fresh Login
                  </span>
                  <h1 className="mt-5 text-5xl leading-[1.1] text-foreground">
                    Welcome
                    <br />
                    back to {env.NEXT_PUBLIC_SITE_NAME}
                  </h1>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-muted">
                    Keep your watchlist in sync, continue where you left off,
                    and discover new picks curated for your mood.
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/45 bg-background p-5">
                  <p className="text-sm text-default-600">
                    <StarFilled className="mr-2 text-accent" />
                    This project is a personal learning demo and is not publicly
                    available. Please do not attempt to access it.
                  </p>
                </div>
              </div>
            </Col>

            <Col className="p-6 sm:p-8 md:p-10" md={12}>
              <div className="mx-auto w-full max-w-sm">
                <div className="mb-7 px-0 pt-10">
                  <Typography.Title className="mb-2 text-center" level={2}>
                    Sign in
                  </Typography.Title>
                  <Typography.Paragraph className="mt-2 text-center">
                    Sign in with your account to continue browsing{" "}
                    {env.NEXT_PUBLIC_SITE_NAME}.
                  </Typography.Paragraph>
                </div>

                <Form
                  layout="vertical"
                  initialValues={{
                    username: undefined,
                    password: undefined,
                  }}
                  onFinish={onSubmit}
                >
                  <Form.Item
                    label="Username"
                    name="username"
                    rules={[
                      { required: true, message: "Username is required." },
                    ]}
                  >
                    <Input
                      id="login-username"
                      placeholder="Username"
                      autoComplete="username"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Password"
                    name="password"
                    rules={[
                      { required: true, message: "Password is required." },
                    ]}
                  >
                    <Input
                      id="login-password"
                      placeholder="Password"
                      autoComplete="password"
                      type="password"
                    />
                  </Form.Item>

                  {error ? (
                    <Form.Item>
                      <p className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-red-500">
                        {error}
                      </p>
                    </Form.Item>
                  ) : null}

                  <Button
                    block
                    disabled={loading}
                    loading={loading}
                    htmlType="submit"
                    type="primary"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </Form>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </section>
  );
}
