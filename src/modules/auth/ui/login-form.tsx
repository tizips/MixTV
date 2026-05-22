"use client";

import {
  ApiOutlined,
  StarFilled,
} from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, Col, Form, Input, Row, Typography } from "antd";
import { env } from "@/shared/env";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (values: { username?: string; password?: string }) => {
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const result = await signIn("credentials", {
          password: values.password,
          redirect: false,
          redirectTo: nextPath,
          username: values.username,
        });

        if (result?.error || !result?.ok) {
          setError("Incorrect username or password.");
          return;
        }

        router.replace(nextPath);
      } catch {
        setError("Unable to sign in right now. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <section className="fixed inset-0 z-80 overflow-auto bg-[radial-gradient(circle_at_12%_14%,rgba(132,216,198,0.28),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(169,227,255,0.3),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(198,235,219,0.36),transparent_50%),linear-gradient(160deg,#edf9f6_0%,#f5fcff_38%,#fbfffd_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_14%_16%,rgba(45,130,110,0.24),transparent_36%),radial-gradient(circle_at_84%_18%,rgba(70,120,190,0.22),transparent_42%),radial-gradient(circle_at_52%_100%,rgba(36,92,82,0.2),transparent_52%),linear-gradient(160deg,#04070b_0%,#07101a_36%,#0b1320_64%,#060c14_100%)] md:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-20 top-20 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/20" />
      <div className="pointer-events-none absolute -right-16 top-10 h-60 w-60 rounded-full bg-sky-400/20 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-teal-300/25 blur-3xl dark:bg-teal-500/20" />

      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-6xl items-center justify-center">
        <Card className="w-full max-w-5xl overflow-hidden border border-slate-950/8 bg-white/72 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65 dark:shadow-[0_30px_80px_-35px_rgba(0,0,0,0.75)]">
          <Row gutter={0} align="stretch">
            <Col className="hidden md:block" md={12}>
              <div className="flex h-full flex-col justify-between p-10">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase dark:border-emerald-300/25 dark:text-emerald-200">
                    <ApiOutlined />
                    Fresh Login
                  </span>
                  <h1 className="mt-5 text-5xl leading-[1.1] text-slate-950 dark:text-slate-50">
                    Welcome
                    <br />
                    back to {env.NEXT_PUBLIC_SITE_NAME}
                  </h1>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600 dark:text-slate-300">
                    Keep your watchlist in sync, continue where you left off,
                    and discover new picks curated for your mood.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-700/12 bg-white/70 p-5 dark:border-emerald-300/20 dark:bg-slate-900/80">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <StarFilled className="mr-2 text-emerald-600 dark:text-emerald-300" />
                    This project is a personal learning demo and is not publicly
                    available. Please do not attempt to access it.
                  </p>
                </div>
              </div>
            </Col>

            <Col className="p-6 sm:p-8 md:p-10" md={12}>
              <div className="mx-auto w-full max-w-sm">
                <div className="px-0 pt-10 mb-7">
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
                    <p className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                      {error}
                    </p>
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
