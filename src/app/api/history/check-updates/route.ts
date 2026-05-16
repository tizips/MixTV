import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkHistoryUpdates } from "@/modules/history/server/history-update-service";
import { recordApiRequest } from "@/modules/stats";

function readUserId(session: unknown) {
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

function encodeSseEvent(eventName: string, data: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const userId = readUserId(await auth());
  const startedAt = performance.now();

  if (!userId) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of checkHistoryUpdates(userId)) {
          controller.enqueue(encoder.encode(encodeSseEvent(event.type, event)));
        }
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: true,
        });
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeSseEvent("error", {
              message: error instanceof Error ? error.message : "History update check failed.",
              type: "error",
            }),
          ),
        );
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
