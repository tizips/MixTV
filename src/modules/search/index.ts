// src/modules/search/index.ts
export type SearchModuleApi = {
  version: "v1";
};

export const searchModuleApi: SearchModuleApi = { version: "v1" };

export { SearchPageShell } from "./ui/search-page-shell";
