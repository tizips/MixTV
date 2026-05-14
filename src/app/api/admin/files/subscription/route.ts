import { NextResponse } from "next/server";
import { getConfigFilesSubscription } from "@/modules/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getConfigFilesSubscription());
  } catch (error) {
    console.error("Failed to load subscription config.", error);
    return NextResponse.json({ message: "Failed to load subscription config." }, { status: 500 });
  }
}
