import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFavorites } from "@/modules/favorites/server/favorite-service";

export async function GET() {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ favorites: await listFavorites(userId) });
}
