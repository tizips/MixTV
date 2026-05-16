import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSearchHistory } from "@/modules/search/server/search-history-service";
import { withApiTraffic } from "@/modules/stats";

type SearchHistoryKeywordRouteContext = {
  params: Promise<{
    keyword: string;
  }>;
};

function toHistoryResponse(history: string[]) {
  return { history };
}

export const DELETE = withApiTraffic(async function DELETE(_request: Request, context: SearchHistoryKeywordRouteContext) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { keyword } = await context.params;
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return NextResponse.json({ message: "keyword is required." }, { status: 400 });
  }

  return NextResponse.json(toHistoryResponse(await deleteSearchHistory(userId, normalizedKeyword)));
});
