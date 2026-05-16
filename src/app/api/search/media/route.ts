import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MediaSearchValidationError, searchMediaSources } from "@/modules/search/server/media-search-service";
import { addSearchHistory } from "@/modules/search/server/search-history-service";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ message: "q is required." }, { status: 400 });
  }

  await addSearchHistory(userId, query);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const summary = await searchMediaSources(
          { query },
          {
            onResult: (result) => controller.enqueue(encodeSseEvent("result", result.results)),
            onStart: (summary) => controller.enqueue(encodeSseEvent("start", summary)),
          },
        );
        controller.enqueue(encodeSseEvent("complete", summary));
      } catch (error) {
        const message = error instanceof MediaSearchValidationError || error instanceof Error
          ? error.message
          : "Failed to search media sources.";
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
