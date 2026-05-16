import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTrafficOverview, StatsDashboard } from "@/modules/stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StatsPage() {
  const session = await auth();
  const isAdmin = session?.user?.admin ?? false;

  if (!session?.user) {
    redirect("/login?next=/stats");
  }

  if (!isAdmin) {
    redirect("/");
  }

  const overview = await getTrafficOverview({
    dayCount: 7,
    timelineMinutes: 120,
  });

  return <StatsDashboard overview={overview} />;
}
