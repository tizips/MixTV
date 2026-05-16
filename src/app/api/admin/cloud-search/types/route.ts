import { NextResponse } from "next/server";
import { withApiTraffic } from "@/modules/stats";

const cloudSearchDriveTypes = [
  { key: "baidu", label: "百度" },
  { key: "aliyun", label: "阿里" },
  { key: "quark", label: "夸克" },
  { key: "tianyi", label: "天翼" },
  { key: "uc", label: "UC" },
  { key: "mobile", label: "移动" },
  { key: "115", label: "115" },
  { key: "123", label: "123" },
  { key: "xunlei", label: "迅雷" },
  { key: "pikpak", label: "PikPak" },
  { key: "guangya", label: "光鸭" },
  { key: "magnet", label: "磁力" },
  { key: "ed2k", label: "电驴" },
  { key: "other", label: "其他" },
];

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(cloudSearchDriveTypes);
  } catch (error) {
    console.error("Failed to load cloud search drive types.", error);
    return NextResponse.json({ message: "Failed to load cloud search drive types." }, { status: 500 });
  }
});
