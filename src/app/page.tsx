import { HomepageShell, getHomepageData } from "@/modules/homepage";

export default async function HomePage() {
  const data = await getHomepageData();

  return <HomepageShell data={data} />;
}
