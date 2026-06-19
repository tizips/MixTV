import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteHistoryPlaybackProgress } from "@/modules/history/server/history-service";
import { createPlaybackProgressStore } from "@/modules/playback/server/playback-progress-service";
import {
  PlaybackSourceSwitchValidationError,
  switchPlaybackSource,
} from "@/modules/playback/server/playback-source-switch-service";
import { recordApiRequest } from "@/modules/stats";

export const runtime = "nodejs";

const sourceSwitchLogPrefix = "[play/source-switch]";

function readRequestPath(request: Request) {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return "unknown";
  }
}

function readStorageDiagnostics() {
  return {
    hasRedisUrl: Boolean(process.env.REDIS_URL?.trim()),
    hasStorageType: Boolean(process.env.STORAGE_TYPE?.trim()),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim()),
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()),
    storageType: process.env.STORAGE_TYPE?.trim() || "",
  };
}

function logSourceSwitchCheckpoint(
  request: Request,
  checkpoint: string,
  startedAt: number,
  extra: Record<string, unknown> = {},
) {
  console.info(sourceSwitchLogPrefix, {
    checkpoint,
    elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    method: request.method,
    path: readRequestPath(request),
    runtime,
    ...readStorageDiagnostics(),
    ...extra,
  });
}

function logSourceSwitchError(
  request: Request,
  checkpoint: string,
  startedAt: number,
  error: unknown,
  extra: Record<string, unknown> = {},
) {
  console.error(sourceSwitchLogPrefix, {
    checkpoint,
    elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    errorMessage: error instanceof Error ? error.message : String(error),
    errorName: error instanceof Error ? error.name : typeof error,
    method: request.method,
    path: readRequestPath(request),
    runtime,
    ...readStorageDiagnostics(),
    ...extra,
  });
}

function recordSourceSwitchTraffic(
  request: Request,
  startedAt: number,
  ok: boolean,
  checkpoint: string,
) {
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  logSourceSwitchCheckpoint(request, checkpoint, startedAt, { ok });
  void Promise.resolve(recordApiRequest({ durationMs, ok })).catch((error) => {
    logSourceSwitchError(request, `${checkpoint}:record-api-request`, startedAt, error, { ok });
  });
}

function readUserIdFromSession(session: unknown) {
  if (!session || typeof session !== "object") {
    return "";
  }

  const user = (session as { user?: unknown }).user;

  if (!user || typeof user !== "object") {
    return "";
  }

  const id = (user as { id?: unknown }).id;

  return typeof id === "string" ? id : "";
}

function asObject(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

async function readJsonObjectPayload(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  const payload = asObject(parsed);

  if (payload) {
    return payload;
  }

  if (typeof parsed === "string") {
    try {
      return asObject(JSON.parse(parsed));
    } catch {
      return null;
    }
  }

  return null;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  return typeof value === "string" ? value.trim() : "";
}

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : Number.NaN;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  logSourceSwitchCheckpoint(request, "entered", startedAt);

  let userId = "";
  try {
    logSourceSwitchCheckpoint(request, "before-auth", startedAt);
    userId = readUserIdFromSession(await auth());
    logSourceSwitchCheckpoint(request, "after-auth", startedAt, {
      authenticated: Boolean(userId),
    });
  } catch (error) {
    logSourceSwitchError(request, "auth-failed", startedAt, error);
    throw error;
  }

  if (!userId) {
    recordSourceSwitchTraffic(request, startedAt, false, "unauthorized");
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let payload: Record<string, unknown> | null;
  try {
    logSourceSwitchCheckpoint(request, "before-read-body", startedAt);
    payload = await readJsonObjectPayload(request);
    logSourceSwitchCheckpoint(request, "after-read-body", startedAt, {
      hasPayload: Boolean(payload),
      payloadKeys: payload ? Object.keys(payload).sort() : [],
    });
  } catch (error) {
    logSourceSwitchError(request, "read-body-failed", startedAt, error);
    throw error;
  }

  if (!payload) {
    recordSourceSwitchTraffic(request, startedAt, false, "invalid-payload");
    return NextResponse.json(
      { message: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const current = {
    id: readString(payload, "currentId"),
    source: readString(payload, "currentSource"),
  };
  const target = {
    id: readString(payload, "targetId"),
    source: readString(payload, "targetSource"),
  };
  const play_episodes = readNumber(payload, "play_episodes");
  const play_time = readNumber(payload, "play_time");
  const total_time = readNumber(payload, "total_time");

  if (!current.id || !current.source || !target.id || !target.source) {
    recordSourceSwitchTraffic(request, startedAt, false, "missing-source-fields");
    return NextResponse.json(
      {
        message:
          "currentId, currentSource, targetId, and targetSource are required.",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(play_episodes) ||
    !Number.isFinite(play_time) ||
    !Number.isFinite(total_time)
  ) {
    recordSourceSwitchTraffic(request, startedAt, false, "missing-time-fields");
    return NextResponse.json(
      { message: "play_episodes, play_time, and total_time are required." },
      { status: 400 },
    );
  }

  try {
    logSourceSwitchCheckpoint(request, "before-create-progress-store", startedAt);
    const progressStore = process.env.STORAGE_TYPE
      ? createPlaybackProgressStore()
      : undefined;
    logSourceSwitchCheckpoint(request, "after-create-progress-store", startedAt, {
      hasProgressStore: Boolean(progressStore),
    });

    logSourceSwitchCheckpoint(request, "before-switch-playback-source", startedAt, {
      currentSource: current.source,
      targetSource: target.source,
    });
    const result = await switchPlaybackSource(
      {
        current,
        play_episodes,
        play_time,
        target,
        total_time,
      },
      {
        ...(progressStore ? { progressStore } : {}),
        userId,
      },
    );
    logSourceSwitchCheckpoint(request, "after-switch-playback-source", startedAt, {
      episodeCount: result.episodes.length,
      sourceCount: result.sources.length,
    });

    if (progressStore) {
      try {
        logSourceSwitchCheckpoint(request, "before-delete-current-history", startedAt);
        await deleteHistoryPlaybackProgress(
          userId,
          { id: current.id, source: current.source },
          { store: progressStore },
        );
        logSourceSwitchCheckpoint(request, "after-delete-current-history", startedAt);
      } catch (error) {
        logSourceSwitchError(request, "delete-current-history-skipped", startedAt, error);
        // Keep the switch result even if cleanup fails.
      }
    }

    recordSourceSwitchTraffic(request, startedAt, true, "success");

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof PlaybackSourceSwitchValidationError ||
      error instanceof Error
        ? error.message
        : "Failed to switch playback source.";
    logSourceSwitchError(request, "switch-failed", startedAt, error);
    recordSourceSwitchTraffic(request, startedAt, false, "failure-response");
    return NextResponse.json({ message }, { status: 400 });
  }
}
