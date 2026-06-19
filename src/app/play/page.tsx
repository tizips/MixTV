import type { Metadata } from "next";
import { auth } from "@/auth";
import { getFavoriteItem } from "@/modules/favorites";
import { getPlaybackHistoryItem } from "@/modules/history";
import { getPlaybackPageData, PlayPageShell } from "@/modules/playback";
import {
  createPlaybackProgressStore,
  type PlaybackProgressStore,
} from "@/modules/playback/server/playback-progress-service";
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

function readStoredPlaybackIndex(record: { index?: string } | null | undefined) {
  return record?.index?.trim() || "";
}

function readStoredPlaybackKeyword(record: { search_title?: string; title?: string } | null | undefined) {
  return record?.search_title?.trim() || record?.title?.trim() || "";
}

function readStoredPlaybackSourceLookup(
  record: { index?: string; search_title?: string; title?: string } | null | undefined,
) {
  return {
    index: readStoredPlaybackIndex(record),
    keyword: readStoredPlaybackKeyword(record),
  };
}

async function resolvePlaybackSourceLookupFromUserRecords({
  id,
  progressStore,
  source,
  userId,
}: {
  id: string;
  progressStore?: PlaybackProgressStore;
  source: string;
  userId: string;
}) {
  if (!id || !source) {
    return { index: "", keyword: "" };
  }

  if (progressStore) {
    const historyLookup = readStoredPlaybackSourceLookup(
      await getPlaybackHistoryItem(
        userId,
        { id, source },
        { store: progressStore },
      ).catch(() => null),
    );

    if (historyLookup.index && historyLookup.keyword) {
      return historyLookup;
    }
  }

  return readStoredPlaybackSourceLookup(
    await getFavoriteItem(userId, { id, source }).catch(() => null),
  );
}

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const resolvedSearchParams = await searchParams;

  if (!userId) {
    return <PlayPageShell playbackPlaceholderError="请先登录后再播放。" />;
  }

  const progressStore = process.env.STORAGE_TYPE ? createPlaybackProgressStore() : undefined;
  const result = await getPlaybackPageData(resolvedSearchParams, { progressStore, userId });

  if (result.status === "error") {
    const source = readSingleParam(resolvedSearchParams.source);
    const id = readSingleParam(resolvedSearchParams.id);
    const playbackSourceLookup = await resolvePlaybackSourceLookupFromUserRecords({
      id,
      ...(progressStore ? { progressStore } : {}),
      source,
      userId,
    });
    const playbackIndex =
      readSingleParam(resolvedSearchParams.index) ||
      playbackSourceLookup.index;

    return (
      <PlayPageShell
        playbackIndex={playbackIndex}
        playbackKeyword={playbackSourceLookup.keyword}
        playbackPlaceholderError={result.error}
      />
    );
  }

  return <PlayPageShell initialData={result.data} />;
}
