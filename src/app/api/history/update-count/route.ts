import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countHistoryUpdates } from "@/modules/history";
import { withApiTraffic } from "@/modules/stats";

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

export const GET = withApiTraffic(async function GET(request: Request) {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await countHistoryUpdates(userId);

    const url = new URL(request.url);

    if (url.searchParams.has("debug")) {
      console.info("Loaded history update count.", {
        history: summary.history,
        userId,
      });

      return NextResponse.json({
        ...summary,
        userId,
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load history update count.", {
      error,
      userId,
    });
    return NextResponse.json({ message: "History update count failed." }, { status: 500 });
  }
});
