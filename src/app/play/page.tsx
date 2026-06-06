import type { Metadata } from "next";
import { auth } from "@/auth";
import { getPlaybackPageData, PlayPageShell } from "@/modules/playback";
import { createPlaybackProgressStore } from "@/modules/playback/server/playback-progress-service";
import { env } from "@/shared/env";

export const metadata: Metadata = {
  title: `播放 - ${env.NEXT_PUBLIC_SITE_NAME}`,
};

export const runtime = "nodejs";

type PlayPageProps = {
  searchParams: Promise<{ id?: string | string[]; index?: string | string[]; source?: string | string[] }>;
};

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0]?.trim() || "" : value?.trim() || "";
}

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const resolvedSearchParams = await searchParams;

  if (!userId) {
    return <PlayPageShell playbackPlaceholderError="请先登录后再播放。" />;
  }

  const progressStore = createPlaybackProgressStore();
  const result = await getPlaybackPageData(resolvedSearchParams, { progressStore, userId });

  if (result.status === "error") {
    return <PlayPageShell playbackIndex={readSingleParam(resolvedSearchParams.index)} playbackPlaceholderError={result.error} />;
  }

  return <PlayPageShell initialData={result.data} />;
}
