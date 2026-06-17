import { HomepageShell, getHomepageData } from "@/modules/homepage";
import {
  defaultHomepageConfig,
  getHomepageConfig,
} from "@/modules/admin/server/homepage-modules-service";
import { mapAdminHomepageConfig } from "./config";

async function readHomepageConfig() {
  try {
    return await getHomepageConfig();
  } catch (error) {
    console.error("Failed to load homepage config; falling back to defaults.", error);
    return defaultHomepageConfig;
  }
}

export default async function HomePage() {
  const homepageConfig = await readHomepageConfig();
  const data = await getHomepageData(mapAdminHomepageConfig(homepageConfig));

  return <HomepageShell data={data} />;
}
