import {
  getEdgeOneKvBinding,
  incrementEdgeOneKvHashFields,
  readEdgeOneKvHash,
  type EdgeOneKvBinding,
} from "@/infrastructure/db/edgeone-kv-db-adapter";

export type StatsBucketKind = "page" | "api" | "third-party";

export interface PageVisitStatInput {
  durationMs?: number;
}

export interface ApiRequestStatInput {
  durationMs?: number;
  ok: boolean;
}

export interface ThirdPartyRequestStatInput {
  durationMs?: number;
  ok: boolean;
}

export interface TrafficMinuteMetric {
  averageDurationMs: number;
  count: number;
  failCount: number;
  successCount: number;
  totalDurationMs: number;
}

export interface TrafficSnapshot {
  checkedAt: string;
  minuteKey: string;
  page: TrafficMinuteMetric;
  api: TrafficMinuteMetric;
  thirdParty: TrafficMinuteMetric;
}

export interface TrafficDaySummary {
  dayKey: string;
  label: string;
  page: TrafficMinuteMetric;
  api: TrafficMinuteMetric;
  thirdParty: TrafficMinuteMetric;
}

export interface TrafficTimelinePoint {
  dayKey: string;
  label: string;
  minuteKey: string;
  page: TrafficMinuteMetric;
  api: TrafficMinuteMetric;
  thirdParty: TrafficMinuteMetric;
}

export interface TrafficOverview {
  checkedAt: string;
  currentMinute: TrafficSnapshot;
  dailySummaries: TrafficDaySummary[];
  timeline: TrafficTimelinePoint[];
}

type StatsStore = EdgeOneKvBinding;

const statsNamespace = "stats";
const statsKvBindingName = "cache";
const statsTtlSeconds = 8 * 24 * 60 * 60;

let statsStore: StatsStore | null = null;

function getStatsStore() {
  statsStore ??= createStatsStore();

  return statsStore;
}

export function createStatsStore() {
  return getEdgeOneKvBinding({
    bindingName: statsKvBindingName,
  });
}

export function resetStatsStoreForTest() {
  statsStore = null;
}

function now() {
  return new Date();
}

function toUtcMinuteParts(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return {
    dayKey: `${year}-${month}-${day}`,
    minuteKey: `${hour}:${minute}`,
  };
}

function normalizeDurationMs(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    const field = value[index];
    const fieldValue = value[index + 1];

    if (typeof field === "string" && typeof fieldValue === "string") {
      record[field] = fieldValue;
    }
  }

  return record;
}

function createDayKey(date: Date) {
  return `day:${toUtcMinuteParts(date).dayKey}`;
}

function createFieldPrefix(kind: StatsBucketKind, minuteKey: string) {
  return `${kind}:${minuteKey}`;
}

function createEmptyMetric(): TrafficMinuteMetric {
  return {
    averageDurationMs: 0,
    count: 0,
    failCount: 0,
    successCount: 0,
    totalDurationMs: 0,
  };
}

function getUtcDateParts(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return { dayKey: `${year}-${month}-${day}` };
}

function getUtcMinuteLabel(date: Date) {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function getDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

async function recordStat(
  kind: StatsBucketKind,
  input: { countDelta?: number; durationMs?: number; ok?: boolean },
  timestamp = now(),
) {
  const { dayKey, minuteKey } = toUtcMinuteParts(timestamp);
  const countDelta = Math.trunc(input.countDelta ?? 0);
  const durationDelta = normalizeDurationMs(input.durationMs);
  const successDelta = input.ok === true ? 1 : 0;
  const failDelta = input.ok === false ? 1 : 0;

  try {
    const fieldPrefix = createFieldPrefix(kind, minuteKey);
    await incrementEdgeOneKvHashFields(getStatsStore(), `day:${dayKey}`, {
      [`${fieldPrefix}:count`]: countDelta,
      [`${fieldPrefix}:duration`]: durationDelta,
      [`${fieldPrefix}:fail`]: failDelta,
      [`${fieldPrefix}:success`]: successDelta,
    }, { namespace: statsNamespace, ttlSeconds: statsTtlSeconds });
  } catch {
    // Stats collection must never break the request flow.
  }
}

export async function recordPageVisit(input: PageVisitStatInput = {}) {
  await recordStat("page", { countDelta: 1, durationMs: input.durationMs });
}

export async function recordPageDuration(input: PageVisitStatInput = {}) {
  await recordStat("page", { durationMs: input.durationMs });
}

export async function recordApiRequest(input: ApiRequestStatInput) {
  await recordStat("api", { countDelta: 1, durationMs: input.durationMs, ok: input.ok });
}

export async function recordThirdPartyRequest(input: ThirdPartyRequestStatInput) {
  await recordStat("third-party", { countDelta: 1, durationMs: input.durationMs, ok: input.ok });
}

function parseMetric(prefix: string, record: Record<string, string>): TrafficMinuteMetric {
  const count = readNumber(Number(record[`${prefix}:count`]));
  const totalDurationMs = readNumber(Number(record[`${prefix}:duration`]));
  const successCount = readNumber(Number(record[`${prefix}:success`]));
  const failCount = readNumber(Number(record[`${prefix}:fail`]));

  return {
    averageDurationMs: count > 0 ? Math.round(totalDurationMs / count) : 0,
    count,
    failCount,
    successCount,
    totalDurationMs,
  };
}

function readMetricFromRecord(record: Record<string, string>, minuteKey: string, kind: StatsBucketKind) {
  const prefix = createFieldPrefix(kind, minuteKey);

  return parseMetric(prefix, record);
}

function aggregateDaySummary(dayKey: string, record: Record<string, string>): TrafficDaySummary {
  const page = createEmptyMetric();
  const api = createEmptyMetric();
  const thirdParty = createEmptyMetric();

  for (const [field, rawValue] of Object.entries(record)) {
    const match = /^(page|api|third-party):\d{2}:\d{2}:(count|duration|success|fail)$/.exec(field);

    if (!match) {
      continue;
    }

    const kind = match[1] as StatsBucketKind;
    const metricKey = match[2];
    const value = Math.max(0, Math.round(Number(rawValue) || 0));
    const target = kind === "page" ? page : kind === "api" ? api : thirdParty;

    if (metricKey === "count") {
      target.count += value;
    } else if (metricKey === "duration") {
      target.totalDurationMs += value;
    } else if (metricKey === "success") {
      target.successCount += value;
    } else if (metricKey === "fail") {
      target.failCount += value;
    }
  }

  page.averageDurationMs = page.count > 0 ? Math.round(page.totalDurationMs / page.count) : 0;
  api.averageDurationMs = api.count > 0 ? Math.round(api.totalDurationMs / api.count) : 0;
  thirdParty.averageDurationMs = thirdParty.count > 0 ? Math.round(thirdParty.totalDurationMs / thirdParty.count) : 0;

  return {
    dayKey,
    label: getDayLabel(dayKey),
    page,
    api,
    thirdParty,
  };
}

async function readTrafficDayRecord(dayKey: string) {
  const record = toHashRecord(await readEdgeOneKvHash(getStatsStore(), `day:${dayKey}`, { namespace: statsNamespace }));

  return record;
}

export async function getTrafficSnapshot(timestamp = now()): Promise<TrafficSnapshot> {
  try {
    const { dayKey, minuteKey } = toUtcMinuteParts(timestamp);
    const record = toHashRecord(await readEdgeOneKvHash(getStatsStore(), createDayKey(timestamp), { namespace: statsNamespace }));
    const pagePrefix = createFieldPrefix("page", minuteKey);
    const apiPrefix = createFieldPrefix("api", minuteKey);
    const thirdPartyPrefix = createFieldPrefix("third-party", minuteKey);

    return {
      checkedAt: timestamp.toISOString(),
      minuteKey: `${dayKey} ${minuteKey}`,
      page: parseMetric(pagePrefix, record),
      api: parseMetric(apiPrefix, record),
      thirdParty: parseMetric(thirdPartyPrefix, record),
    };
  } catch {
    return {
      checkedAt: timestamp.toISOString(),
      minuteKey: `${toUtcMinuteParts(timestamp).dayKey} ${toUtcMinuteParts(timestamp).minuteKey}`,
      page: {
        averageDurationMs: 0,
        count: 0,
        failCount: 0,
        successCount: 0,
        totalDurationMs: 0,
      },
      api: {
        averageDurationMs: 0,
        count: 0,
        failCount: 0,
        successCount: 0,
        totalDurationMs: 0,
      },
      thirdParty: {
        averageDurationMs: 0,
        count: 0,
        failCount: 0,
        successCount: 0,
        totalDurationMs: 0,
      },
    };
  }
}

export async function getTrafficOverview({
  dayCount = 7,
  now: nowProvider = now,
  timelineMinutes = 180,
}: {
  dayCount?: number;
  now?: () => Date;
  timelineMinutes?: number;
} = {}): Promise<TrafficOverview> {
  const current = nowProvider();
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const safeTimelineMinutes = Math.max(1, Math.floor(timelineMinutes));
  const currentMinute = await getTrafficSnapshot(current);

  const dayKeys = Array.from({ length: safeDayCount }, (_, index) => {
    const dayOffset = safeDayCount - index - 1;
    const date = new Date(current.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    return getUtcDateParts(date).dayKey;
  });
  const createEmptyOverview = () => {
    const dailySummaries = dayKeys.map((dayKey) => ({
      dayKey,
      label: getDayLabel(dayKey),
      page: createEmptyMetric(),
      api: createEmptyMetric(),
      thirdParty: createEmptyMetric(),
    }));
    const timeline = Array.from({ length: safeTimelineMinutes }, (_, index) => {
      const minuteOffset = safeTimelineMinutes - index - 1;
      const date = new Date(current.getTime() - minuteOffset * 60 * 1000);
      const { dayKey } = getUtcDateParts(date);
      const minuteKey = getUtcMinuteLabel(date);

      return {
        dayKey,
        label: minuteKey,
        minuteKey,
        page: createEmptyMetric(),
        api: createEmptyMetric(),
        thirdParty: createEmptyMetric(),
      };
    });

    return {
      checkedAt: current.toISOString(),
      currentMinute,
      dailySummaries,
      timeline,
    };
  };

  let dayRecords: Array<readonly [string, Record<string, string>]>;

  try {
    dayRecords = await Promise.all(dayKeys.map(async (dayKey) => [dayKey, await readTrafficDayRecord(dayKey)] as const));
  } catch {
    return createEmptyOverview();
  }

  const dayRecordMap = new Map(dayRecords);
  const dailySummaries = dayKeys.map((dayKey) => aggregateDaySummary(dayKey, dayRecordMap.get(dayKey) ?? {}));

  const timeline = Array.from({ length: safeTimelineMinutes }, (_, index) => {
    const minuteOffset = safeTimelineMinutes - index - 1;
    const date = new Date(current.getTime() - minuteOffset * 60 * 1000);
    const { dayKey } = getUtcDateParts(date);
    const minuteKey = getUtcMinuteLabel(date);
    const record = dayRecordMap.get(dayKey) ?? {};

    return {
      dayKey,
      label: minuteKey,
      minuteKey,
      page: readMetricFromRecord(record, minuteKey, "page"),
      api: readMetricFromRecord(record, minuteKey, "api"),
      thirdParty: readMetricFromRecord(record, minuteKey, "third-party"),
    };
  });

  return {
    checkedAt: current.toISOString(),
    currentMinute,
    dailySummaries,
    timeline,
  };
}

export function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0ms";
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  const seconds = value / 1000;
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)}s`;
}

export function formatRate(count: number, totalDurationMs: number) {
  return `${Math.round(count)} 次 · ${formatDurationMs(totalDurationMs)}`;
}
