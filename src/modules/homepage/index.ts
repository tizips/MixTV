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

export type {
  HomepageData,
} from "./application/homepage-service";
export { getHomepageData } from "./application/homepage-service";

export type {
  MockHomepageData,
} from "./application/mock-data-provider";
export { getMockHomepageData } from "./application/mock-data-provider";
