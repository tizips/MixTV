import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSearchHistory } from "@/modules/search/server/search-history-service";

function toHistoryResponse(history: string[]) {
  return { history };
}

export async function GET() {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(toHistoryResponse(await listSearchHistory(userId)));
}
