import { NextResponse } from "next/server";
import { getSiteConfig } from "@/modules/admin/server/site-config-service";

export async function GET() {
  try {
    return NextResponse.json(await getSiteConfig());
  } catch (error) {
    console.error("Failed to load site config.", error);
    return NextResponse.json({ message: "Failed to load site config." }, { status: 500 });
  }
}
