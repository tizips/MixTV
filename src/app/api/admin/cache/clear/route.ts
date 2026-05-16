import { NextResponse } from "next/server";
import { AdminModuleValidationError } from "@/modules/admin/server/admin-module-error";
import { clearCache } from "@/modules/admin/server/cache-management-service";
import { withApiTraffic } from "@/modules/stats";

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(await clearCache(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Failed to clear cache.", error);
    return NextResponse.json({ message: "Failed to clear cache." }, { status: 500 });
  }
});
