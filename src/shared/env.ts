function readBooleanEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export const env = {
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "MixTV",
  VIDEO_SOURCE_DELETE_INVALID_ON_CHECK: readBooleanEnv(process.env.VIDEO_SOURCE_DELETE_INVALID_ON_CHECK),
} as const;
