// src/modules/playback/index.ts
export { getPlaybackPageData } from "./server/playback-service";
export { PlayPageShell } from "./ui/play-page-shell";
export type { PlaybackPageQuery, PlaybackPageResult } from "./server/playback-service";

export type PlaybackModuleApi = {
  version: "v1";
};

export const playbackModuleApi: PlaybackModuleApi = { version: "v1" };
