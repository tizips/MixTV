import { HomepageShell, getHomepageData } from "@/modules/homepage";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";
import { getHomepageConfig } from "@/modules/admin/server/homepage-modules-service";
import { mapAdminHomepageConfig } from "./config";

export const runtime = "nodejs";

export default async function HomePage() {
  ensureEdgeOneKvBindingsForNode();

  const homepageConfig = await getHomepageConfig();
  const data = await getHomepageData(mapAdminHomepageConfig(homepageConfig));

  return <HomepageShell data={data} />;
}
