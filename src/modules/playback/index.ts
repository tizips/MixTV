// src/modules/playback/index.ts
export { PlayPageShell } from "./ui/play-page-shell";

export type PlaybackModuleApi = {
  version: "v1";
};

export const playbackModuleApi: PlaybackModuleApi = { version: "v1" };
