import { Button, Card, Checkbox, Form, Input, Label, TextField } from "@heroui/react";

export default function LoginPage() {
  return (
    <section
      className="fixed inset-0 z-[80] overflow-auto bg-[radial-gradient(circle_at_12%_14%,rgba(132,216,198,0.28),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(169,227,255,0.3),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(198,235,219,0.36),transparent_50%),linear-gradient(160deg,#edf9f6_0%,#f5fcff_38%,#fbfffd_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_14%_16%,rgba(45,130,110,0.24),transparent_36%),radial-gradient(circle_at_84%_18%,rgba(70,120,190,0.22),transparent_42%),radial-gradient(circle_at_52%_100%,rgba(36,92,82,0.2),transparent_52%),linear-gradient(160deg,#04070b_0%,#07101a_36%,#0b1320_64%,#060c14_100%)] md:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute -left-20 top-20 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/20" />
      <div className="pointer-events-none absolute -right-16 top-10 h-60 w-60 rounded-full bg-sky-400/20 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-teal-300/25 blur-3xl dark:bg-teal-500/20" />

      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-6xl items-center justify-center">
        <Card className="grid w-full max-w-5xl overflow-hidden border border-slate-950/8 bg-white/72 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65 dark:shadow-[0_30px_80px_-35px_rgba(0,0,0,0.75)] md:grid-cols-[1.1fr_1fr]">
          <Card.Content className="hidden p-10 md:flex md:flex-col md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase dark:border-emerald-300/25 dark:text-emerald-200">
                <i className="bi bi-flower1" aria-hidden="true" />
                Fresh Login
              </span>
              <h1 className="mt-5 text-5xl leading-[1.1] text-slate-950 dark:text-slate-50">
                Welcome
                <br />
                back to MixTV
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600 dark:text-slate-300">
                Keep your watchlist in sync, continue where you left off, and
                discover new picks curated for your mood.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-700/12 bg-white/70 p-5 dark:border-emerald-300/20 dark:bg-slate-900/80">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <i className="bi bi-stars mr-2 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                This project is a personal learning demo and is not publicly
                available. Please do not attempt to access it.
              </p>
            </div>
          </Card.Content>

          <Card.Content className="p-6 sm:p-8 md:p-10">
            <div className="mx-auto w-full max-w-sm">
              <Card.Header className="px-0 pt-0">
                <Card.Title className="text-center text-4xl text-slate-950 dark:text-slate-100">Sign in</Card.Title>
                <Card.Description className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                  Use your account to continue watching.
                </Card.Description>
              </Card.Header>

              <Form className="mt-7 space-y-5">
                <TextField fullWidth name="email" variant="secondary">
                  <Label className="text-slate-800 dark:text-slate-200">Email</Label>
                  <Input
                    autoComplete="email"
                    className="text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    id="login-email"
                    placeholder="you@example.com"
                    type="email"
                  />
                </TextField>

                <TextField fullWidth name="password" variant="secondary">
                  <Label className="text-slate-800 dark:text-slate-200">Password</Label>
                  <Input
                    autoComplete="current-password"
                    className="text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    id="login-password"
                    placeholder="••••••••"
                    type="password"
                  />
                </TextField>

                <div className="flex items-center justify-between pt-1">
                  <Checkbox name="remember">
                    <Checkbox.Control className="border-slate-300 bg-white/80 dark:border-white/15 dark:bg-slate-900/80">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content className="text-slate-700 dark:text-slate-300">Remember me</Checkbox.Content>
                  </Checkbox>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="mt-2 w-full bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  Sign in
                </Button>
              </Form>
            </div>
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
