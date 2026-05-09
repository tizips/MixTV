// src/modules/homepage/index.ts
export type {
  HomepageConfig,
} from "./domain/homepage-config";
export { defaultHomepageConfig } from "./domain/homepage-config";

export type {
  ContentType,
  ContentItem,
  HeroItem,
} from "./domain/content-types";

export type {
  HomepageSectionKey,
} from "./domain/section-types";
export { homepageSectionOrder } from "./domain/section-types";
