import { NextResponse } from "next/server";
import { refreshCacheStats } from "@/modules/admin/server/cache-management-service";

export async function POST() {
  try {
    return NextResponse.json(await refreshCacheStats());
  } catch (error) {
    console.error("Failed to refresh cache stats.", error);
    return NextResponse.json({ message: "Failed to refresh cache stats." }, { status: 500 });
  }
}
