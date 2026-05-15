import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteFavorite, FavoriteValidationError } from "@/modules/favorites/server/favorite-service";

interface FavoriteRouteContext {
  params: Promise<{
    favoriteKey: string;
  }>;
}

export async function DELETE(_request: Request, context: FavoriteRouteContext) {
  const session = await auth();
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { favoriteKey } = await context.params;

  try {
    return NextResponse.json({ favorites: await deleteFavorite(userId, favoriteKey) });
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to delete favorite." }, { status: 500 });
  }
}
