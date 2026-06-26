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

const cloudSearchDriveTypeKeys = [
  "baidu",
  "aliyun",
  "quark",
  "tianyi",
  "uc",
  "mobile",
  "115",
  "123",
  "xunlei",
  "pikpak",
  "guangya",
  "magnet",
  "ed2k",
  "other",
] as const;

export const defaultCloudSearchPanSouUrl = "https://so.252035.xyz";

const cloudSearchPanSouUrlSchema = z
  .string({ error: "panSouUrl is required." })
  .trim()
  .transform((value) => value || defaultCloudSearchPanSouUrl);

export const cloudSearchConfigRequestSchema = z
  .object({
    enabled: z.boolean({ error: "enabled is required." }),
    panSouUrl: cloudSearchPanSouUrlSchema,
    requestTimeoutSeconds: z.number({ error: "requestTimeoutSeconds is required." }),
    supportedDriveTypes: z
      .array(z.enum(cloudSearchDriveTypeKeys, { error: "supportedDriveTypes is invalid." }))
      .min(1, "请至少选择一种网盘类型。"),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      const url = new URL(value.panSouUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "请输入有效的 PanSou 服务地址。",
        path: ["panSouUrl"],
      });
    }

    if (!Number.isFinite(value.requestTimeoutSeconds)) {
      context.addIssue({
        code: "custom",
        message: "requestTimeoutSeconds is invalid.",
        path: ["requestTimeoutSeconds"],
      });
    }
  });

export const cloudSearchTestRequestSchema = z
  .object({
    panSouUrl: cloudSearchPanSouUrlSchema,
  })
  .strict()
  .superRefine((value, context) => {
    try {
      const url = new URL(value.panSouUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "请输入有效的 PanSou 服务地址。",
        path: ["panSouUrl"],
      });
    }
  });

const danmakuLoadModeKeys = ["full", "segment"] as const;

const danmakuApiUrlSchema = z
  .string({ error: "apiUrl is required." })
  .trim()
  .min(1, "请输入弹幕服务地址。");

const danmakuApiTokenSchema = z
  .string({ error: "apiToken is required." })
  .trim()
  .min(1, "请输入弹幕访问令牌。");

function addDanmakuUrlIssue(context: z.RefinementCtx) {
  context.addIssue({
    code: "custom",
    message: "请输入有效的弹幕服务地址。",
    path: ["apiUrl"],
  });
}

export const danmakuConfigRequestSchema = z
  .object({
    enabled: z.boolean({ error: "enabled is required." }),
    apiUrl: danmakuApiUrlSchema,
    apiToken: danmakuApiTokenSchema,
    requestTimeoutSeconds: z.number({ error: "requestTimeoutSeconds is required." }),
    loadMode: z.enum(danmakuLoadModeKeys, { error: "loadMode is invalid." }),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      const url = new URL(value.apiUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      addDanmakuUrlIssue(context);
    }

    if (!Number.isFinite(value.requestTimeoutSeconds)) {
      context.addIssue({
        code: "custom",
        message: "requestTimeoutSeconds is invalid.",
        path: ["requestTimeoutSeconds"],
      });
    }
  });

export const danmakuTestRequestSchema = z
  .object({
    apiUrl: danmakuApiUrlSchema,
    apiToken: danmakuApiTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    try {
      const url = new URL(value.apiUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      addDanmakuUrlIssue(context);
    }
  });

export const timingManagementConfigRequestSchema = z
  .object({
    autoRefreshEnabled: z.boolean({ error: "autoRefreshEnabled is required." }),
    maxRecordsPerRun: z
      .number({ error: "maxRecordsPerRun is required." })
      .int("maxRecordsPerRun must be an integer.")
      .min(1, "maxRecordsPerRun must be at least 1.")
      .max(1000, "maxRecordsPerRun must be at most 1000."),
    maxSearchPages: z
      .number({ error: "maxSearchPages is required." })
      .int("maxSearchPages must be an integer.")
      .min(1, "maxSearchPages must be at least 1.")
      .max(20, "maxSearchPages must be at most 20."),
    onlyRefreshOngoingSeries: z.boolean({ error: "onlyRefreshOngoingSeries is required." }),
    recentActiveDays: z
      .number({ error: "recentActiveDays is required." })
      .int("recentActiveDays must be an integer.")
      .min(1, "recentActiveDays must be at least 1.")
      .max(365, "recentActiveDays must be at most 365."),
    siteCacheSeconds: z
      .number({ error: "siteCacheSeconds is required." })
      .int("siteCacheSeconds must be an integer.")
      .min(0, "siteCacheSeconds must be at least 0.")
      .max(86400, "siteCacheSeconds must be at most 86400."),
  })
  .strict();
