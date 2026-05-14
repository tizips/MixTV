import { z } from "zod";

const proxyModes = [
  "direct",
  "zwei",
  "official-ali",
  "cml-tencent",
  "cml-ali",
  "custom",
] as const;

const siteConfigSwitchKeys = [
  "enableKeywordFilter",
  "showAdultContent",
  "enableStreamingSearch",
] as const;

const homepageModuleKeys = [
  "welcome-announcement",
  "carousel",
  "continue-watching",
  "coming-soon",
  "trending-movies",
  "trending-series",
  "new-anime",
  "trending-variety",
  "trending-short-dramas",
] as const;

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function httpUrlSchema(requiredMessage: string, invalidMessage: string) {
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .refine(isValidHttpUrl, invalidMessage);
}

export function getAdminConfigValidationMessage(error: z.ZodError) {
  const firstIssue = error.issues[0];

  if (error.issues.some((issue) => issue.code === "unrecognized_keys")) {
    return "请求体包含不支持的字段。";
  }

  if (firstIssue?.code === "invalid_type" && firstIssue.path.length === 0) {
    return "Request body must be an object.";
  }

  return firstIssue?.message ?? "请求体校验失败。";
}

export const configContentRequestSchema = z
  .object({
    content: z
      .string({ error: "content is required." })
      .refine((value) => value.trim().length > 0, "请输入配置内容。")
      .refine(isValidJson, "配置内容必须是有效 JSON。"),
  })
  .strict();

export const configSubscriptionPullRequestSchema = z
  .object({
    url: httpUrlSchema("url is required.", "请输入有效的订阅链接。"),
  })
  .strict();

export const configSubscriptionAutoUpdateRequestSchema = z
  .object({
    autoUpdate: z.boolean({ error: "autoUpdate is required." }),
  })
  .strict();

export const siteConfigMainRequestSchema = z
  .object({
    doubanAuth: z.string({ error: "doubanAuth is required." }).trim(),
    doubanDataProxyMode: z.enum(proxyModes, { error: "doubanDataProxyMode is invalid." }),
    doubanDataProxyUrl: z.string({ error: "doubanDataProxyUrl is required." }).trim(),
    doubanImageProxyMode: z.enum(proxyModes, { error: "doubanImageProxyMode is invalid." }),
    doubanImageProxyUrl: z.string({ error: "doubanImageProxyUrl is required." }).trim(),
    siteAnnouncement: z.string({ error: "siteAnnouncement is required." }).trim().optional(),
    siteName: z.string({ error: "siteName is required." }).trim().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.doubanDataProxyMode === "custom" && !isValidHttpUrl(value.doubanDataProxyUrl)) {
      context.addIssue({
        code: "custom",
        message: "请输入有效的豆瓣代理地址。",
        path: ["doubanDataProxyUrl"],
      });
    }

    if (value.doubanImageProxyMode === "custom" && !isValidHttpUrl(value.doubanImageProxyUrl)) {
      context.addIssue({
        code: "custom",
        message: "请输入有效的图片代理地址。",
        path: ["doubanImageProxyUrl"],
      });
    }
  });

export const siteConfigSwitchRequestSchema = z
  .object({
    key: z.enum(siteConfigSwitchKeys, { error: "key is invalid." }),
    value: z.boolean({ error: "value is required." }),
  })
  .strict();

export const homepageConfigSwitchRequestSchema = z
  .object({
    key: z.enum(homepageModuleKeys, { error: "key is invalid." }),
    value: z.boolean({ error: "value is required." }),
  })
  .strict();
