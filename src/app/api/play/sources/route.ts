import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteHistoryPlaybackProgress } from "@/modules/history/server/history-service";
import { PlaybackSourcesValidationError, getPlaybackSources } from "@/modules/playback/server/playback-source-service";
import {
  PlaybackSourceSwitchValidationError,
  switchPlaybackSource,
} from "@/modules/playback/server/playback-source-switch-service";
import { createPlaybackProgressStore } from "@/modules/playback/server/playback-progress-service";
import { recordApiRequest } from "@/modules/stats";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const startedAt = performance.now();

  if (!userId) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const index = searchParams.get("index") ?? "";

  if (!index.trim()) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "index is required." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const summary = await getPlaybackSources(
          { index },
          {
            onResult: (result) => controller.enqueue(encodeSseEvent("result", result)),
            onStart: (result) => controller.enqueue(encodeSseEvent("start", result)),
          },
        );
        controller.enqueue(encodeSseEvent("complete", summary));
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: true,
        });
      } catch (error) {
        const message = error instanceof PlaybackSourcesValidationError || error instanceof Error
          ? error.message
          : "Failed to load playback sources.";
        controller.enqueue(encodeSseEvent("error", { message }));
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: false,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

function asObject(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

async function readJsonObjectPayload(request: Request) {
  const body = await request.text();

  if (!body.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
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
  } catch {
    return null;
  }
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
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const startedAt = performance.now();

  if (!userId) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let payload: Record<string, unknown> | null = null;

  payload = await readJsonObjectPayload(request);

  if (!payload) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "Request body must be a JSON object." }, { status: 400 });
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
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "currentId, currentSource, targetId, and targetSource are required." }, { status: 400 });
  }

  if (!Number.isFinite(play_episodes) || !Number.isFinite(play_time) || !Number.isFinite(total_time)) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "play_episodes, play_time, and total_time are required." }, { status: 400 });
  }

  try {
    const progressStore = process.env.STORAGE_TYPE ? createPlaybackProgressStore() : undefined;
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

    if (progressStore) {
      try {
        await deleteHistoryPlaybackProgress(
          userId,
          { id: current.id, source: current.source },
          { store: progressStore },
        );
      } catch {
        // Keep the switch result even if cleanup fails.
      }
    }

    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof PlaybackSourceSwitchValidationError || error instanceof Error
      ? error.message
      : "Failed to switch playback source.";
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message }, { status: 400 });
  }
}
