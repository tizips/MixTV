import type { Metadata } from "next";
import { auth } from "@/auth";
import { getPlaybackPageData, PlayPageShell } from "@/modules/playback";

export const metadata: Metadata = {
  title: "播放 - MixTV",
};

type PlayPageProps = {
  searchParams: Promise<{ id?: string | string[]; source?: string | string[] }>;
};

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return <PlayPageShell playbackPlaceholderError="请先登录后再播放。" />;
  }

  const result = await getPlaybackPageData(await searchParams, { userId });

  if (result.status === "error") {
    return <PlayPageShell playbackPlaceholderError={result.error} />;
  }

  return <PlayPageShell initialData={result.data} />;
}
