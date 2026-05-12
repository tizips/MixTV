import { AdminTabs } from "./admin-tabs";

export function AdminPageShell() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <div className="mt-8">
        <AdminTabs />
      </div>
    </section>
  );
}
