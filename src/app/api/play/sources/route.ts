import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  PlaybackSourcesValidationError,
  getPlaybackSources,
} from "@/modules/playback/server/playback-source-service";
import { recordApiRequest } from "@/modules/stats";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const playbackSourcesTimeoutMs = 15_000;

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toPublicSseData(event: string, data: unknown) {
  if (event !== "result" || !data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const publicData = { ...(data as Record<string, unknown>) };
  delete publicData.ping;

  return publicData;
}

function createPlaybackSourcesTimeout() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("Playback source lookup timed out."));
    }, playbackSourcesTimeoutMs);
  });

  return {
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
      }
    },
    promise,
  };
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
  const keyword = searchParams.get("keyword") ?? "";

  if (!index.trim()) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json(
      { message: "index is required." },
      { status: 400 },
    );
  }

  if (!keyword.trim()) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json(
      { message: "keyword is required." },
      { status: 400 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const timeout = createPlaybackSourcesTimeout();
      let isClosed = false;
      const enqueueEvent = (event: string, data: unknown) => {
        if (!isClosed) {
          controller.enqueue(encodeSseEvent(event, toPublicSseData(event, data)));
        }
      };

      try {
        const summary = await Promise.race([
          getPlaybackSources(
            { index, keyword },
            {
              onResult: (result) => enqueueEvent("result", result),
              onStart: (result) => enqueueEvent("start", result),
            },
          ),
          timeout.promise,
        ]);
        enqueueEvent("complete", summary);
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: true,
        });
      } catch (error) {
        const message =
          error instanceof PlaybackSourcesValidationError ||
          error instanceof Error
            ? error.message
            : "Failed to load playback sources.";
        enqueueEvent("error", { message });
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: false,
        });
      } finally {
        timeout.cancel();
        isClosed = true;
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
