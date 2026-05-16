import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteHistoryPlaybackProgress,
  HistoryValidationError,
} from "@/modules/history/server/history-service";
import { listHistoryResponse } from "../../history-response";

type HistoryItemRouteContext = {
  params: Promise<{ id: string; source: string }>;
};

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

export async function DELETE(_request: Request, context: HistoryItemRouteContext) {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id, source } = await context.params;
    const history = await deleteHistoryPlaybackProgress(userId, { id, source });

    return NextResponse.json({ history: await listHistoryResponse(userId, history) });
  } catch (error) {
    if (error instanceof HistoryValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to delete history item." }, { status: 500 });
  }
}
