import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";
import { MediaSearchValidationError, searchMediaSources } from "@/modules/search/server/media-search-service";
import { addSearchHistory } from "@/modules/search/server/search-history-service";
import { recordApiRequest } from "@/modules/stats";

const encoder = new TextEncoder();
const mediaSearchMaxPages = 1;
const mediaSearchProviderTimeoutMs = 5_000;

export const runtime = "nodejs";

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  ensureEdgeOneKvBindingsForNode();

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
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "q is required." }, { status: 400 });
  }

  try {
    await addSearchHistory(userId, query);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const summary = await searchMediaSources(
            { query },
            {
              maxPages: mediaSearchMaxPages,
              onResult: (result) => controller.enqueue(encodeSseEvent("result", result.results)),
              onStart: (summary) => controller.enqueue(encodeSseEvent("start", summary)),
              timeoutMs: mediaSearchProviderTimeoutMs,
            },
          );
          controller.enqueue(encodeSseEvent("complete", summary));
          void recordApiRequest({
            durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
            ok: true,
          });
        } catch (error) {
          const message = error instanceof MediaSearchValidationError || error instanceof Error
            ? error.message
            : "Failed to search media sources.";
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
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch (error) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    const message = error instanceof Error ? error.message : "Failed to search media sources.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
