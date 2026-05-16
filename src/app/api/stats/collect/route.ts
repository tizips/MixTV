import { NextResponse } from "next/server";
import { recordPageDurationBeacon, recordPageVisitBeacon } from "@/modules/stats";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { kind?: unknown; durationMs?: unknown };

    if (payload.kind === "visit") {
      await recordPageVisitBeacon();
    } else if (payload.kind === "duration") {
      const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : Number(payload.durationMs);
      await recordPageDurationBeacon(Number.isFinite(durationMs) ? durationMs : undefined);
    }
  } catch {
    // Stats collection must never break the page request flow.
  }

  return new NextResponse(null, { status: 204 });
}
