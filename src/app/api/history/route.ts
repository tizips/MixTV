import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPlaybackHistory } from "@/modules/history/server/history-service";
import { listHistoryResponse } from "./history-response";
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

export const GET = withApiTraffic(async function GET() {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const history = await listPlaybackHistory(userId);

  return NextResponse.json({ history: await listHistoryResponse(userId, history) });
});
