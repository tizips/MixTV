import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFavorite, deleteFavorite, FavoriteValidationError } from "@/modules/favorites/server/favorite-service";

type FavoriteItemRouteContext = {
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

export async function POST(_request: Request, context: FavoriteItemRouteContext) {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id, source } = await context.params;
    const favorite = await createFavorite({ id, source }, { userId });

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to create favorite." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: FavoriteItemRouteContext) {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id, source } = await context.params;
    const favorites = await deleteFavorite(userId, { id, source });

    return NextResponse.json({ favorites });
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to delete favorite." }, { status: 500 });
  }
}
