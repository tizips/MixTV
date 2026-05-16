import { NextResponse } from "next/server";
import { checkVideoSourceValidities } from "@/modules/admin/server/video-source-service";
import { recordApiRequest } from "@/modules/stats";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";

  if (!keyword.trim()) {
    void recordApiRequest({
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ok: false,
    });
    return NextResponse.json({ message: "keyword is required." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const collection = await checkVideoSourceValidities(
          { keyword },
          {
            onResult: (result) => controller.enqueue(encodeSseEvent("result", result)),
            onStart: (summary) => controller.enqueue(encodeSseEvent("start", summary)),
          },
        );
        controller.enqueue(encodeSseEvent("complete", collection));
        void recordApiRequest({
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ok: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check video source validities.";
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
}
