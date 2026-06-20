import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import { createTrackedThirdPartyFetch } from "@/modules/stats";
import type { DbPort } from "@/shared/db/db-port";
import { AdminModuleValidationError } from "./admin-module-error";

export { AdminModuleValidationError } from "./admin-module-error";

export type VideoSourceStatus = "enabled" | "disabled";
export type VideoSourceType = "normal" | "short-drama";
export type VideoSourceValidity = "valid" | "warning" | "invalid" | "checking";
export type VideoSourceBatchAction = "enable" | "disable";

export interface VideoSourceItem {
  name: string;
  key: string;
  apiUrl: string;
  no: number;
  status: VideoSourceStatus;
  adult: boolean;
  type: VideoSourceType;
  weight: number;
  validity: VideoSourceValidity;
  updatedAt: string | null;
}

export interface VideoSourceCollection {
  sources: VideoSourceItem[];
  updatedAt: string | null;
}

export type VideoSourceStore = DbPort<unknown, string>;

export interface VideoSourceValidityCheckResult {
  apiUrl: string;
  key: string;
  name: string;
  validity: Extract<VideoSourceValidity, "valid" | "invalid">;
}

export interface VideoSourceValidityCheckOptions {
  fetcher?: typeof fetch;
  onResult?: (result: VideoSourceValidityCheckResult) => void;
  onStart?: (summary: { total: number }) => void;
  removeInvalidSources?: boolean;
  store?: VideoSourceStore;
}

const storeNamespace = "admin";
const videoSourcesKey = "sources";

const sourceStatuses = new Set<VideoSourceStatus>(["enabled", "disabled"]);
const sourceTypes = new Set<VideoSourceType>(["normal", "short-drama"]);
const sourceValidities = new Set<VideoSourceValidity>(["valid", "warning", "invalid"]);
const batchActions = new Set<VideoSourceBatchAction>(["enable", "disable"]);

const readVideoSourcesScript = `
return redis.call("HGETALL", KEYS[1])
`;

const saveVideoSourceScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return 1
`;

const deleteVideoSourceScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return 1
`;

const defaultVideoSources: VideoSourceCollection = {
  sources: [],
  updatedAt: null,
};

interface ConfigVideoSourceInput {
  apiUrl: string;
  key: string;
  name: string;
  no: number;
}

export function createVideoSourceStore(): VideoSourceStore {
  return createDbAdapter<unknown>({ namespace: storeNamespace });
}

function now() {
  return new Date().toISOString();
}

function asObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AdminModuleValidationError("Request body must be an object.");
  }

  return payload as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, key: string): string;
function readString(payload: Record<string, unknown>, key: string, required: false): string | undefined;
function readString(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "string") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value.trim();
}

function readBoolean(payload: Record<string, unknown>, key: string): boolean;
function readBoolean(payload: Record<string, unknown>, key: string, required: false): boolean | undefined;
function readBoolean(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "boolean") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value;
}

function readNumber(payload: Record<string, unknown>, key: string, fallback: number, min: number, max: number) {
  const value = payload[key];
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function isOneOf<T extends string>(value: unknown, values: Set<T>): value is T {
  return typeof value === "string" && values.has(value as T);
}

function toHashRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  if (!Array.isArray(value)) {
    return {};
  }

  const record: Record<string, string> = {};

  for (let index = 0; index < value.length; index += 2) {
    const key = value[index];
    const fieldValue = value[index + 1];

    if (typeof key === "string" && typeof fieldValue === "string") {
      record[key] = fieldValue;
    }
  }

  return record;
}

export async function getVideoSources(store: VideoSourceStore = createVideoSourceStore()) {
  return readStoredVideoSources(store);
}

function normalizeVideoSource(input: unknown, fallback?: VideoSourceItem): VideoSourceItem {
  const payload = asObject(input);
  const name = fallback ? readString(payload, "name", false) ?? fallback.name : readString(payload, "name");
  const key = fallback ? readString(payload, "key", false) ?? fallback.key : readString(payload, "key");
  const apiUrl = fallback ? readString(payload, "apiUrl", false) ?? fallback.apiUrl : readString(payload, "apiUrl");
  const adult = fallback ? readBoolean(payload, "adult", false) ?? fallback.adult : readBoolean(payload, "adult");
  const status = payload.status ?? fallback?.status;
  const type = payload.type ?? fallback?.type;
  const validity = payload.validity ?? fallback?.validity ?? "warning";

  if (!isOneOf(status, sourceStatuses)) {
    throw new AdminModuleValidationError("status is invalid.");
  }
  if (!isOneOf(type, sourceTypes)) {
    throw new AdminModuleValidationError("type is invalid.");
  }
  if (!isOneOf(validity, sourceValidities)) {
    throw new AdminModuleValidationError("validity is invalid.");
  }

  return {
    name,
    key,
    apiUrl,
    status,
    adult,
    no: readNumber(payload, "no", fallback?.no ?? 0, 0, 999999),
    type,
    weight: readNumber(payload, "weight", fallback?.weight ?? 50, 1, 99),
    validity,
    updatedAt: fallback
      ? now()
      : typeof payload.updatedAt === "string" || payload.updatedAt === null
        ? payload.updatedAt
        : now(),
  };
}

function parseStoredVideoSources(record: Record<string, string>): VideoSourceItem[] {
  return Object.entries(record)
    .map(([key, rawSource]) => {
      try {
        const source = normalizeVideoSource(JSON.parse(rawSource));

        if (source.key !== key) {
          return null;
        }

        return source;
      } catch {
        return null;
      }
    })
    .filter((source): source is VideoSourceItem => source !== null)
    .sort(compareVideoSources);
}

function compareVideoSources(left: VideoSourceItem, right: VideoSourceItem) {
  const leftNo = left.no === 0 ? Number.MAX_SAFE_INTEGER : left.no;
  const rightNo = right.no === 0 ? Number.MAX_SAFE_INTEGER : right.no;

  return leftNo - rightNo || left.weight - right.weight || left.key.localeCompare(right.key);
}

function createVideoSourceSearchUrl(source: VideoSourceItem, keyword: string) {
  const url = new URL(source.apiUrl);
  url.searchParams.set("wd", keyword);
  return url.toString();
}

function hasNonEmptySearchResult(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.trim().length > 0;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["list", "data", "results", "result", "items"]) {
    const candidate = record[key];

    if (Array.isArray(candidate)) {
      return candidate.length > 0;
    }
  }

  for (const key of ["total", "totalCount", "count"]) {
    const candidate = record[key];

    if (typeof candidate === "number" && candidate > 0) {
      return true;
    }
  }

  return false;
}

async function detectVideoSourceValidity(
  source: VideoSourceItem,
  keyword: string,
  fetcher: typeof fetch,
): Promise<Extract<VideoSourceValidity, "valid" | "invalid">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const trackedFetcher = fetcher === fetch ? createTrackedThirdPartyFetch(fetch) : fetcher;
    const response = await trackedFetcher(createVideoSourceSearchUrl(source, keyword), { signal: controller.signal });

    if (!response.ok) {
      return "invalid";
    }

    const text = await response.text();

    if (!text.trim()) {
      return "invalid";
    }

    try {
      return hasNonEmptySearchResult(JSON.parse(text) as unknown) ? "valid" : "invalid";
    } catch {
      return "valid";
    }
  } catch {
    return "invalid";
  } finally {
    clearTimeout(timeout);
  }
}

function readConfigVideoSources(content: string): ConfigVideoSourceInput[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const apiSite = (parsed as Record<string, unknown>).api_site;

  if (!apiSite || typeof apiSite !== "object" || Array.isArray(apiSite)) {
    return [];
  }

  let no = 0;
  return Object.entries(apiSite).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    const source = value as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const apiUrl = typeof source.api === "string" ? source.api.trim() : "";

    if (!key || !name || !apiUrl) {
      return [];
    }

    no += 1;
    return [{ apiUrl, key, name, no }];
  });
}

function getVideoSourcesUpdatedAt(sources: VideoSourceItem[]) {
  return sources.reduce<string | null>((latest, source) => {
    const timestamp = source.updatedAt;
    return timestamp && (latest === null || timestamp > latest) ? timestamp : latest;
  }, null);
}

function toVideoSourceCollection(sources: VideoSourceItem[]): VideoSourceCollection {
  return {
    sources: [...sources].sort(compareVideoSources),
    updatedAt: getVideoSourcesUpdatedAt(sources),
  };
}

async function readStoredVideoSourceItems(store: VideoSourceStore): Promise<VideoSourceItem[]> {
  return parseStoredVideoSources(
    toHashRecord(
      await store.script(readVideoSourcesScript, {
        keys: [videoSourcesKey],
        readOnly: true,
      }),
    ),
  );
}

async function readStoredVideoSources(store: VideoSourceStore): Promise<VideoSourceCollection> {
  const sources = await readStoredVideoSourceItems(store);

  if (sources.length === 0) {
    return defaultVideoSources;
  }

  return toVideoSourceCollection(sources);
}

async function saveVideoSourceRecord(source: VideoSourceItem, store: VideoSourceStore) {
  await store.script(saveVideoSourceScript, {
    args: [source.key, JSON.stringify(source)],
    keys: [videoSourcesKey],
  });
}

async function deleteVideoSourceRecord(key: string, store: VideoSourceStore) {
  await store.script(deleteVideoSourceScript, {
    args: [key],
    keys: [videoSourcesKey],
  });
}

export async function createVideoSource(input: unknown, store: VideoSourceStore = createVideoSourceStore()) {
  const current = await readStoredVideoSourceItems(store);
  const source = normalizeVideoSource(input);

  if (current.some((item) => item.key === source.key)) {
    throw new AdminModuleValidationError("source key already exists.");
  }

  await saveVideoSourceRecord(source, store);
  return source;
}

export async function updateVideoSource(
  key: string,
  input: unknown,
  store: VideoSourceStore = createVideoSourceStore(),
) {
  const payload = asObject(input);

  if (typeof payload.key === "string" && payload.key.trim() !== key) {
    throw new AdminModuleValidationError("source key cannot be changed.");
  }

  const current = await readStoredVideoSourceItems(store);
  const existing = current.find((source) => source.key === key);

  if (!existing) {
    throw new AdminModuleValidationError("source not found.");
  }

  const updated = normalizeVideoSource(payload, existing);
  await saveVideoSourceRecord(updated, store);

  const sources = current.map((source) => (source.key === key ? updated : source));
  return toVideoSourceCollection(sources);
}

export async function deleteVideoSource(key: string, store: VideoSourceStore = createVideoSourceStore()) {
  const current = await readStoredVideoSourceItems(store);

  if (!current.some((source) => source.key === key)) {
    throw new AdminModuleValidationError("source not found.");
  }

  await deleteVideoSourceRecord(key, store);

  return toVideoSourceCollection(current.filter((source) => source.key !== key));
}

export async function batchUpdateVideoSources(input: unknown, store: VideoSourceStore = createVideoSourceStore()) {
  const payload = asObject(input);
  const keys = Array.isArray(payload.keys) ? payload.keys.filter((key): key is string => typeof key === "string") : [];
  const action = readString(payload, "action");

  if (!isOneOf(action, batchActions)) {
    throw new AdminModuleValidationError("action is invalid.");
  }

  const status: VideoSourceStatus = action === "enable" ? "enabled" : "disabled";
  const current = await readStoredVideoSourceItems(store);
  const selected = new Set(keys);
  const sources = current.map((source) => {
    if (!selected.has(source.key)) {
      return source;
    }

    return normalizeVideoSource({ ...source, status }, source);
  });

  for (const source of sources) {
    if (selected.has(source.key)) {
      await saveVideoSourceRecord(source, store);
    }
  }

  return toVideoSourceCollection(sources);
}

export async function checkVideoSourceValidities(
  input: unknown,
  {
    fetcher = fetch,
    onResult,
    onStart,
    removeInvalidSources = false,
    store = createVideoSourceStore(),
  }: VideoSourceValidityCheckOptions = {},
) {
  const payload = asObject(input);
  const keyword = readString(payload, "keyword");

  if (!keyword) {
    throw new AdminModuleValidationError("keyword is required.");
  }

  const current = await readStoredVideoSourceItems(store);
  const checkedSources: VideoSourceItem[] = [];
  onStart?.({ total: current.length });

  for (const source of current) {
    const validity = await detectVideoSourceValidity(source, keyword, fetcher);
    const checkedSource = normalizeVideoSource({ ...source, validity }, source);

    if (removeInvalidSources && validity === "invalid") {
      await deleteVideoSourceRecord(source.key, store);
    } else {
      await saveVideoSourceRecord(checkedSource, store);
      checkedSources.push(checkedSource);
    }

    onResult?.({
      apiUrl: checkedSource.apiUrl,
      key: checkedSource.key,
      name: checkedSource.name,
      validity,
    });
  }

  return toVideoSourceCollection(checkedSources);
}

export async function syncVideoSourcesFromConfigContent(
  content: string,
  store: VideoSourceStore = createVideoSourceStore(),
) {
  const configSources = readConfigVideoSources(content);
  const current = await readStoredVideoSourceItems(store);
  const currentByKey = new Map(current.map((source) => [source.key, source]));
  const syncedByKey = new Map(currentByKey);
  const configKeys = new Set(configSources.map((source) => source.key));

  for (const source of configSources) {
    const existing = currentByKey.get(source.key);
    const adult = source.name.startsWith("🔞") ? true : existing?.adult ?? false;
    const synced: VideoSourceItem = existing
      ? {
          ...existing,
          adult,
          apiUrl: source.apiUrl,
          name: source.name,
          no: source.no,
        }
      : {
          adult,
          apiUrl: source.apiUrl,
          key: source.key,
          name: source.name,
          no: source.no,
          status: "enabled",
          type: "normal",
          updatedAt: now(),
          validity: "warning",
          weight: 50,
        };

    await saveVideoSourceRecord(synced, store);
    syncedByKey.set(source.key, synced);
  }

  for (const source of current) {
    if (!configKeys.has(source.key) && source.no !== 0) {
      const synced = { ...source, no: 0 };
      await saveVideoSourceRecord(synced, store);
      syncedByKey.set(source.key, synced);
    }
  }

  return toVideoSourceCollection([...syncedByKey.values()]);
}
