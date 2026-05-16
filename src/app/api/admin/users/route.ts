import { NextResponse } from "next/server";
import { getUsers } from "@/modules/admin/server/user-config-service";
import { withApiTraffic } from "@/modules/stats";

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(await getUsers());
  } catch (error) {
    console.error("Failed to load users.", error);
    return NextResponse.json({ message: "Failed to load users." }, { status: 500 });
  }
});
