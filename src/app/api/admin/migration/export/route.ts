import { NextResponse } from "next/server";
import { AdminModuleValidationError } from "@/modules/admin/server/admin-module-error";
import { exportMigrationBackup } from "@/modules/admin/server/migration-service";
import { withApiTraffic } from "@/modules/stats";

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(await exportMigrationBackup(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to export backup." }, { status: 500 });
  }
});
