export interface EdgeOneKvBinding {
  delete(key: string): Promise<void>;
  get(key: string, options?: { type?: string } | string): Promise<unknown>;
  list(options?: { cursor?: string; limit?: number; prefix?: string }): Promise<{
    cursor?: string;
    keys?: Array<string | { key?: string; name?: string }>;
    list_complete?: boolean;
    complete?: boolean;
  }>;
  put(key: string, value: string): Promise<void>;
}

export interface EdgeOneKvBindingOptions {
  binding?: EdgeOneKvBinding;
  bindingName: string;
}

export interface EdgeOneKvRecordOptions {
  keyPrefix?: string;
  namespace?: string;
  now?: () => number;
}

export interface EdgeOneKvWriteOptions extends EdgeOneKvRecordOptions {
  ttlSeconds?: number;
}

type EdgeOneKvEntry =
  | { expiresAt?: number; kind: "hash"; value: Record<string, string>; version: 1 }
  | { expiresAt?: number; kind: "json"; value: string; version: 1 }
  | { expiresAt?: number; kind: "list"; value: string[]; version: 1 }
  | { expiresAt?: number; kind: "string"; value: string; version: 1 };

const defaultKeyPrefix = "mixtv_v1_";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function isEdgeOneKvBinding(value: unknown): value is EdgeOneKvBinding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const binding = value as Partial<EdgeOneKvBinding>;

  return typeof binding.delete === "function"
    && typeof binding.get === "function"
    && typeof binding.list === "function"
    && typeof binding.put === "function";
}

export function readGlobalEdgeOneKvBinding(bindingName: string) {
  const binding = (globalThis as Record<string, unknown>)[bindingName];

  return isEdgeOneKvBinding(binding) ? binding : null;
}

export function getEdgeOneKvBinding({ binding, bindingName }: EdgeOneKvBindingOptions) {
  const resolvedBinding = binding ?? readGlobalEdgeOneKvBinding(bindingName);

  if (!resolvedBinding) {
    throw new Error(`EdgeOne KV binding "${bindingName}" is required for storage.`);
  }

  return resolvedBinding;
}

function toHex(value: string) {
  return [...textEncoder.encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string) {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return textDecoder.decode(bytes);
}

function encodeKvKey(logicalKey: string, keyPrefix: string) {
  const key = `${keyPrefix}${toHex(logicalKey)}`;

  if (textEncoder.encode(key).byteLength > 512) {
    throw new Error("EdgeOne KV key is too long after encoding.");
  }

  return key;
}

function decodeKvKey(kvKey: string, keyPrefix: string) {
  if (!kvKey.startsWith(keyPrefix)) {
    return null;
  }

  return fromHex(kvKey.slice(keyPrefix.length));
}

function createLogicalKey(key: string, { namespace = "" }: EdgeOneKvRecordOptions = {}) {
  return namespace ? `${namespace}:${key}` : key;
}

function createEncodedKey(key: string, options: EdgeOneKvRecordOptions = {}) {
  return encodeKvKey(createLogicalKey(key, options), options.keyPrefix ?? defaultKeyPrefix);
}

function applyExpiry<TEntry extends EdgeOneKvEntry>(entry: TEntry, options: EdgeOneKvWriteOptions = {}): TEntry {
  if (typeof options.ttlSeconds !== "number" || options.ttlSeconds <= 0) {
    return entry;
  }

  return {
    ...entry,
    expiresAt: (options.now ?? Date.now)() + options.ttlSeconds * 1000,
  };
}

function isEdgeOneKvEntry(value: unknown): value is EdgeOneKvEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entry = value as Partial<EdgeOneKvEntry>;

  if (entry.version !== 1) {
    return false;
  }

  if (typeof entry.expiresAt !== "undefined" && typeof entry.expiresAt !== "number") {
    return false;
  }

  if (entry.kind === "hash") {
    return Boolean(entry.value)
      && typeof entry.value === "object"
      && !Array.isArray(entry.value)
      && Object.values(entry.value).every((item) => typeof item === "string");
  }

  if (entry.kind === "json" || entry.kind === "string") {
    return typeof entry.value === "string";
  }

  if (entry.kind === "list") {
    return Array.isArray(entry.value) && entry.value.every((item) => typeof item === "string");
  }

  return false;
}

function parseEdgeOneKvEntry(raw: unknown): EdgeOneKvEntry | null {
  if (raw === null || typeof raw === "undefined") {
    return null;
  }

  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return isEdgeOneKvEntry(parsed) ? parsed : null;
}

async function readEdgeOneKvEntry(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  const encodedKey = createEncodedKey(key, options);
  const entry = parseEdgeOneKvEntry(await binding.get(encodedKey));

  if (!entry) {
    return null;
  }

  if (typeof entry.expiresAt === "number" && entry.expiresAt <= (options.now ?? Date.now)()) {
    await binding.delete(encodedKey);
    return null;
  }

  return entry;
}

async function writeEdgeOneKvEntry(
  binding: EdgeOneKvBinding,
  key: string,
  entry: EdgeOneKvEntry,
  options: EdgeOneKvWriteOptions = {},
) {
  await binding.put(createEncodedKey(key, options), JSON.stringify(applyExpiry(entry, options)));
}

export async function deleteEdgeOneKvEntry(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  await binding.delete(createEncodedKey(key, options));
}

export async function readEdgeOneKvJson<TValue>(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
): Promise<TValue | null> {
  const entry = await readEdgeOneKvEntry(binding, key, options);

  if (entry?.kind !== "json") {
    return null;
  }

  return JSON.parse(entry.value) as TValue;
}

export async function writeEdgeOneKvJson<TValue>(
  binding: EdgeOneKvBinding,
  key: string,
  value: TValue,
  options: EdgeOneKvWriteOptions = {},
) {
  await writeEdgeOneKvEntry(binding, key, {
    kind: "json",
    value: JSON.stringify(value),
    version: 1,
  }, options);
}

export async function readEdgeOneKvHash(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  const entry = await readEdgeOneKvEntry(binding, key, options);

  return entry?.kind === "hash" ? { ...entry.value } : {};
}

export async function writeEdgeOneKvHash(
  binding: EdgeOneKvBinding,
  key: string,
  value: Record<string, string>,
  options: EdgeOneKvWriteOptions = {},
) {
  await writeEdgeOneKvEntry(binding, key, {
    kind: "hash",
    value,
    version: 1,
  }, options);
}

export async function patchEdgeOneKvHash(
  binding: EdgeOneKvBinding,
  key: string,
  fields: Record<string, string>,
  options: EdgeOneKvWriteOptions = {},
) {
  const hash = await readEdgeOneKvHash(binding, key, options);

  await writeEdgeOneKvHash(binding, key, { ...hash, ...fields }, options);
}

export async function readEdgeOneKvHashField(
  binding: EdgeOneKvBinding,
  key: string,
  field: string,
  options: EdgeOneKvRecordOptions = {},
) {
  const hash = await readEdgeOneKvHash(binding, key, options);

  return hash[field] ?? null;
}

export async function deleteEdgeOneKvHashField(
  binding: EdgeOneKvBinding,
  key: string,
  field: string,
  options: EdgeOneKvWriteOptions = {},
) {
  const hash = await readEdgeOneKvHash(binding, key, options);

  delete hash[field];

  if (Object.keys(hash).length === 0) {
    await deleteEdgeOneKvEntry(binding, key, options);
  } else {
    await writeEdgeOneKvHash(binding, key, hash, options);
  }

  return hash;
}

export async function moveEdgeOneKvHashField(
  binding: EdgeOneKvBinding,
  key: string,
  currentField: string,
  targetField: string,
  targetValue: string,
  options: EdgeOneKvWriteOptions = {},
) {
  const hash = await readEdgeOneKvHash(binding, key, options);

  if (!hash[currentField]) {
    return null;
  }

  hash[targetField] = targetValue;
  delete hash[currentField];
  await writeEdgeOneKvHash(binding, key, hash, options);

  return targetValue;
}

export async function incrementEdgeOneKvHashFields(
  binding: EdgeOneKvBinding,
  key: string,
  increments: Record<string, number>,
  options: EdgeOneKvWriteOptions = {},
) {
  const hash = await readEdgeOneKvHash(binding, key, options);

  for (const [field, delta] of Object.entries(increments)) {
    if (delta !== 0) {
      hash[field] = String((Number(hash[field]) || 0) + delta);
    }
  }

  await writeEdgeOneKvHash(binding, key, hash, options);
}

export async function readEdgeOneKvString(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  const entry = await readEdgeOneKvEntry(binding, key, options);

  return entry?.kind === "string" ? entry.value : null;
}

export async function writeEdgeOneKvString(
  binding: EdgeOneKvBinding,
  key: string,
  value: string,
  options: EdgeOneKvWriteOptions = {},
) {
  await writeEdgeOneKvEntry(binding, key, {
    kind: "string",
    value,
    version: 1,
  }, options);
}

export async function readEdgeOneKvList(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  const entry = await readEdgeOneKvEntry(binding, key, options);

  return entry?.kind === "list" ? [...entry.value] : [];
}

export async function writeEdgeOneKvList(
  binding: EdgeOneKvBinding,
  key: string,
  value: string[],
  options: EdgeOneKvWriteOptions = {},
) {
  await writeEdgeOneKvEntry(binding, key, {
    kind: "list",
    value,
    version: 1,
  }, options);
}

function globToRegExp(pattern: string) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`);
}

function readListKeyName(key: string | { key?: string; name?: string }) {
  return typeof key === "string" ? key : key.name ?? key.key ?? "";
}

function readListCursor(result: Awaited<ReturnType<EdgeOneKvBinding["list"]>>) {
  if (result.list_complete === true || result.complete === true) {
    return "";
  }

  return result.cursor ?? "";
}

export async function listEdgeOneKvLogicalKeys(
  binding: EdgeOneKvBinding,
  {
    limit = 1000,
    pattern = "*",
    keyPrefix = defaultKeyPrefix,
  }: {
    keyPrefix?: string;
    limit?: number;
    pattern?: string;
  } = {},
) {
  const matcher = globToRegExp(pattern);
  const keys: string[] = [];
  let cursor = "";

  do {
    const result = await binding.list({
      ...(cursor ? { cursor } : {}),
      limit,
      prefix: keyPrefix,
    });

    for (const key of result.keys ?? []) {
      const logicalKey = decodeKvKey(readListKeyName(key), keyPrefix);

      if (logicalKey && matcher.test(logicalKey)) {
        keys.push(logicalKey);
      }
    }

    cursor = readListCursor(result);
  } while (cursor);

  return keys.sort();
}

export async function cleanupExpiredEdgeOneKvEntries(
  binding: EdgeOneKvBinding,
  {
    expiresBefore,
    limit = 1000,
    pattern = "*",
    keyPrefix = defaultKeyPrefix,
  }: {
    expiresBefore: number;
    keyPrefix?: string;
    limit?: number;
    pattern?: string;
  },
) {
  const matcher = globToRegExp(pattern);
  let scanned = 0;
  let deleted = 0;
  let cursor = "";

  do {
    const result = await binding.list({
      ...(cursor ? { cursor } : {}),
      limit,
      prefix: keyPrefix,
    });

    for (const key of result.keys ?? []) {
      const kvKey = readListKeyName(key);
      const logicalKey = decodeKvKey(kvKey, keyPrefix);

      if (!logicalKey || !matcher.test(logicalKey)) {
        continue;
      }

      scanned += 1;

      const entry = parseEdgeOneKvEntry(await binding.get(kvKey));

      if (typeof entry?.expiresAt === "number" && entry.expiresAt <= expiresBefore) {
        await binding.delete(kvKey);
        deleted += 1;
      }
    }

    cursor = readListCursor(result);
  } while (cursor);

  return { deleted, scanned };
}
