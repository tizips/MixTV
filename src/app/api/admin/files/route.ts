import { NextResponse } from "next/server";
import { getConfigFiles } from "@/modules/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getConfigFiles());
  } catch (error) {
    console.error("Failed to load config files.", error);
    return NextResponse.json({ message: "Failed to load config files." }, { status: 500 });
  }
}
