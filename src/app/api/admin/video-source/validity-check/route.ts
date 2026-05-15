import { NextResponse } from "next/server";
import { checkVideoSourceValidities } from "@/modules/admin/server/video-source-service";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";

  if (!keyword.trim()) {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check video source validities.";
        controller.enqueue(encodeSseEvent("error", { message }));
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
