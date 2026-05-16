import { HomepageShell, getHomepageData } from "@/modules/homepage";
import { getHomepageConfig } from "@/modules/admin/server/homepage-modules-service";
import { mapAdminHomepageConfig } from "./config";

export default async function HomePage() {
  const homepageConfig = await getHomepageConfig();
  const data = await getHomepageData(mapAdminHomepageConfig(homepageConfig));

  return <HomepageShell data={data} />;
}
