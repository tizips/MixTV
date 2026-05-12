import type { Metadata } from "next";
import { PlayPageShell } from "@/modules/playback";

export const metadata: Metadata = {
  title: "播放 - MixTV",
};

export default function PlayPage() {
  return <PlayPageShell />;
}
