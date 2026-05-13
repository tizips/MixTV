export default function LoginPage() {
  return (
    <section
      className="fixed inset-0 z-[80] overflow-auto px-4 py-12 md:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 14% 16%, rgba(45, 130, 110, 0.24), transparent 36%), radial-gradient(circle at 84% 18%, rgba(70, 120, 190, 0.22), transparent 42%), radial-gradient(circle at 52% 100%, rgba(36, 92, 82, 0.2), transparent 52%), linear-gradient(160deg, #04070b 0%, #07101a 36%, #0b1320 64%, #060c14 100%)",
      }}
    >
      <div className="pointer-events-none absolute -left-20 top-20 h-52 w-52 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-10 h-60 w-60 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-3xl" />

      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.75)] backdrop-blur-xl md:grid-cols-[1.1fr_1fr]">
          <aside className="relative hidden p-10 md:flex md:flex-col md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-200 uppercase">
                <i className="bi bi-flower1" aria-hidden="true" />
                Fresh Login
              </span>
              <h1 className="mt-5 text-5xl leading-[1.1] text-slate-50">
                Welcome
                <br />
                back to MixTV
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">
                Keep your watchlist in sync, continue where you left off, and
                discover new picks curated for your mood.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-300">
                <i className="bi bi-stars mr-2 text-emerald-300" aria-hidden="true" />
                This project is a personal learning demo and is not publicly
                available. Please do not attempt to access it.
              </p>
            </div>
          </aside>

          <div className="relative p-6 sm:p-8 md:p-10">
            <div className="mx-auto w-full max-w-sm">
              <h2 className="text-center text-4xl text-slate-100">
                Sign in
              </h2>
              <p className="mt-2 text-center text-sm text-slate-400">
                Use your account to continue watching.
              </p>

              <form className="mt-7 space-y-4">
                <label className="block text-sm text-slate-300" htmlFor="email">
                  Email
                </label>
                <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 transition focus-within:border-emerald-300/80 focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.16)]">
                  <i className="bi bi-envelope text-slate-500" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>

                <label className="block text-sm text-slate-300" htmlFor="password">
                  Password
                </label>
                <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 transition focus-within:border-emerald-300/80 focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.16)]">
                  <i className="bi bi-lock text-slate-500" aria-hidden="true" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center pt-1 text-sm">
                  <label className="flex items-center gap-2 text-slate-400">
                    <input type="checkbox" className="accent-emerald-500" />
                    Remember me
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_12px_30px_-14px_rgba(5,150,105,0.7)]"
                >
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  Sign in
                </button>
              </form>

            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
