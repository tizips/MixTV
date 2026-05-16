import { NextResponse } from "next/server";
import { getConfigFiles } from "@/modules/admin";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(await getConfigFiles());
  } catch (error) {
    console.error("Failed to load config files.", error);
    return NextResponse.json({ message: "Failed to load config files." }, { status: 500 });
  }
});
