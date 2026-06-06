import type { DbPort, DbScriptArgument, DbScriptOptions } from "@/shared/db/db-port";

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

export interface EdgeOneKvDbOptions {
  binding?: EdgeOneKvBinding;
  bindingName?: string;
  keyPrefix?: string;
  namespace: string;
  now?: () => number;
}

type EdgeOneKvEntry =
  | { expiresAt?: number; kind: "hash"; value: Record<string, string>; version: 1 }
  | { expiresAt?: number; kind: "json"; value: string; version: 1 }
  | { expiresAt?: number; kind: "list"; value: string[]; version: 1 }
  | { expiresAt?: number; kind: "string"; value: string; version: 1 };

const defaultBindingName = "user";
const defaultKeyPrefix = "mixtv_v1_";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const buildItemKey = (namespace: string, id: string) => namespace ? `${namespace}:${id}` : id;
const buildScriptKey = (namespace: string, key: string) => namespace ? `${namespace}:${key}` : key;

const serializeScriptArgument = (arg: DbScriptArgument): string => {
  if (arg === null) {
    return "";
  }

  return String(arg);
};

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

function readGlobalBinding(bindingName: string) {
  const globalRecord = globalThis as Record<string, unknown>;
  const binding = globalRecord[bindingName];

  return isEdgeOneKvBinding(binding) ? binding : null;
}

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

function resolveEdgeOneKvBinding(options: EdgeOneKvDbOptions) {
  const bindingName = options.bindingName ?? defaultBindingName;
  const binding = options.binding ?? readGlobalBinding(bindingName);

  if (!binding) {
    throw new Error(`EdgeOne KV binding "${bindingName}" is required for edgeone-kv storage.`);
  }

  return binding;
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

function toHashArray(record: Record<string, string>) {
  return Object.entries(record).flat();
}

function parseNumber(value: string | undefined, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function getFirstKey(keys: string[]) {
  const key = keys[0];

  if (!key) {
    throw new Error("EdgeOne KV adapter script requires KEYS[1].");
  }

  return key;
}

function splitLuaArguments(source: string) {
  const args: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of source) {
    if (char === "\"") {
      quoted = !quoted;
      current += char;
      continue;
    }

    if (char === "," && !quoted) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function readLuaToken(token: string, args: string[]) {
  const stringMatch = token.match(/^"([^"]*)"$/);

  if (stringMatch) {
    return stringMatch[1] ?? "";
  }

  const argMatch = token.match(/^ARGV\[(\d+)\]$/);

  if (argMatch) {
    return args[Number(argMatch[1]) - 1] ?? "";
  }

  const numberArgMatch = token.match(/^tonumber\(ARGV\[(\d+)\]\)$/);

  if (numberArgMatch) {
    return args[Number(numberArgMatch[1]) - 1] ?? "";
  }

  if (token === "ARGV[#ARGV]") {
    return args.at(-1) ?? "";
  }

  return undefined;
}

function readExpireSeconds(script: string, args: string[]) {
  const setExMatch = script.match(/redis\.call\("SET",\s*KEYS\[1\],\s*ARGV\[\d+\],\s*"EX",\s*ARGV\[(\d+)\]\)/);

  if (setExMatch) {
    return parseNumber(args[Number(setExMatch[1]) - 1]);
  }

  const directMatch = script.match(/redis\.call\("EXPIRE",\s*KEYS\[1\],\s*ARGV\[(\d+)\]\)/);

  if (directMatch) {
    return parseNumber(args[Number(directMatch[1]) - 1]);
  }

  if (/redis\.call\("EXPIRE",\s*KEYS\[1\],\s*ARGV\[#ARGV\]\)/.test(script)) {
    return parseNumber(args.at(-1));
  }

  const ttlMatch = script.match(/local\s+ttl\s*=\s*tonumber\(ARGV\[(\d+)\]\)/);

  if (ttlMatch && /redis\.call\("EXPIRE",\s*KEYS\[1\],\s*ttl\)/.test(script)) {
    return parseNumber(args[Number(ttlMatch[1]) - 1]);
  }

  return 0;
}

function withExpiry<TEntry extends EdgeOneKvEntry>(
  entry: TEntry,
  script: string,
  args: string[],
  now: () => number,
): TEntry {
  const ttlSeconds = readExpireSeconds(script, args);

  if (ttlSeconds <= 0) {
    return entry;
  }

  return {
    ...entry,
    expiresAt: now() + ttlSeconds * 1000,
  };
}

function extractHsetPairs(script: string, args: string[]) {
  if (/for\s+index\s*=\s*1,\s*#ARGV\s*-\s*1,\s*2\s+do/.test(script)) {
    const pairs: Array<[string, string]> = [];

    for (let index = 0; index < args.length - 1; index += 2) {
      pairs.push([args[index] ?? "", args[index + 1] ?? ""]);
    }

    return pairs;
  }

  const pairs: Array<[string, string]> = [];
  const calls = script.matchAll(/redis\.call\("HSET",\s*KEYS\[1\],\s*([\s\S]*?)\)/g);

  for (const call of calls) {
    const tokens = splitLuaArguments(call[1] ?? "");

    for (let index = 0; index < tokens.length; index += 2) {
      const field = readLuaToken(tokens[index] ?? "", args);
      const value = readLuaToken(tokens[index + 1] ?? "", args);

      if (typeof field === "string" && typeof value === "string") {
        pairs.push([field, value]);
      }
    }
  }

  return pairs;
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

function isCleanupExpiredEntriesScript(script: string) {
  return /redis\.call\("SCAN"/.test(script)
    && /redis\.call\("GET"/.test(script)
    && /redis\.call\("DEL"/.test(script)
    && /cjson\.decode/.test(script)
    && /expiresAt/.test(script)
    && /deleted/.test(script)
    && /scanned/.test(script);
}

function lrange(list: string[], end: string | undefined) {
  return list.slice(0, Math.max(0, Math.floor(parseNumber(end))) + 1);
}

export const createEdgeOneKvDbAdapter = <TValue>(
  options: EdgeOneKvDbOptions,
): DbPort<TValue, string> => {
  const binding = resolveEdgeOneKvBinding(options);
  const keyPrefix = options.keyPrefix ?? defaultKeyPrefix;
  const now = options.now ?? Date.now;

  const readEntry = async (logicalKey: string): Promise<EdgeOneKvEntry | null> => {
    const raw = await binding.get(encodeKvKey(logicalKey, keyPrefix));
    const parsed = parseEdgeOneKvEntry(raw);

    if (!parsed) {
      return null;
    }

    if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= now()) {
      await binding.delete(encodeKvKey(logicalKey, keyPrefix));
      return null;
    }

    return parsed;
  };

  const writeEntry = async (logicalKey: string, entry: EdgeOneKvEntry) => {
    await binding.put(encodeKvKey(logicalKey, keyPrefix), JSON.stringify(entry));
  };

  const deleteEntry = async (logicalKey: string) => {
    await binding.delete(encodeKvKey(logicalKey, keyPrefix));
  };

  const readHash = async (logicalKey: string) => {
    const entry = await readEntry(logicalKey);

    return entry?.kind === "hash" ? { ...entry.value } : {};
  };

  const writeHash = async (logicalKey: string, value: Record<string, string>, script: string, args: string[]) => {
    await writeEntry(logicalKey, withExpiry({ kind: "hash", value, version: 1 }, script, args, now));
  };

  const readList = async (logicalKey: string) => {
    const entry = await readEntry(logicalKey);

    return entry?.kind === "list" ? [...entry.value] : [];
  };

  const writeList = async (logicalKey: string, value: string[], script: string, args: string[]) => {
    await writeEntry(logicalKey, withExpiry({ kind: "list", value, version: 1 }, script, args, now));
  };

  const runScanScript = async (args: string[]) => {
    const pattern = args[0] ?? "*";
    const limit = Math.max(1, Math.floor(parseNumber(args[1], 1000)));
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
  };

  const runCleanupExpiredEntriesScript = async (args: string[]) => {
    const pattern = args[0] ?? "*";
    const limit = Math.max(1, Math.floor(parseNumber(args[1], 1000)));
    const expiresBefore = parseNumber(args[2], now());
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
  };

  const runScript = async <TResult = unknown>(
    script: string,
    runOptions: DbScriptOptions<string> = {},
  ) => {
    const keys = runOptions.keys?.map((key) => buildScriptKey(options.namespace, key)) ?? [];
    const args = runOptions.args?.map(serializeScriptArgument) ?? [];

    if (isCleanupExpiredEntriesScript(script)) {
      return await runCleanupExpiredEntriesScript(args) as TResult;
    }

    if (/redis\.call\("SCAN"/.test(script)) {
      return await runScanScript(args) as TResult;
    }

    if (/local\s+current\s*=\s*redis\.call\("HGET"/.test(script)
      && /redis\.call\("HSET",\s*KEYS\[1\],\s*ARGV\[2\],\s*ARGV\[3\]\)/.test(script)
      && /redis\.call\("HDEL",\s*KEYS\[1\],\s*ARGV\[1\]\)/.test(script)) {
      const key = getFirstKey(keys);
      const hash = await readHash(key);
      const current = hash[args[0] ?? ""];

      if (!current) {
        return null as TResult;
      }

      hash[args[1] ?? ""] = args[2] ?? "";
      delete hash[args[0] ?? ""];
      await writeHash(key, hash, script, args);

      return (args[2] ?? "") as TResult;
    }

    if (/redis\.call\("HINCRBY"/.test(script)) {
      const key = getFirstKey(keys);
      const hash = await readHash(key);
      const fieldPrefix = args[0] ?? "";
      const increments: Array<[string, number]> = [
        [`${fieldPrefix}:count`, parseNumber(args[1])],
        [`${fieldPrefix}:duration`, parseNumber(args[2])],
        [`${fieldPrefix}:success`, parseNumber(args[3])],
        [`${fieldPrefix}:fail`, parseNumber(args[4])],
      ];

      for (const [field, delta] of increments) {
        if (delta !== 0) {
          hash[field] = String(parseNumber(hash[field]) + delta);
        }
      }

      await writeHash(key, hash, script, args);

      return 1 as TResult;
    }

    if (/redis\.call\("HSET"/.test(script)) {
      const key = getFirstKey(keys);
      const hash = await readHash(key);
      const pairs = extractHsetPairs(script, args);

      if (pairs.length === 0) {
        throw new Error("EdgeOne KV adapter does not support this storage script.");
      }

      for (const [field, value] of pairs) {
        hash[field] = value;
      }

      await writeHash(key, hash, script, args);

      if (/return\s+ARGV\[2\]/.test(script)) {
        return (args[1] ?? "") as TResult;
      }

      if (/return\s+redis\.call\("HGETALL"/.test(script)) {
        return toHashArray(hash) as TResult;
      }

      return 1 as TResult;
    }

    if (/redis\.call\("HDEL"/.test(script)) {
      const key = getFirstKey(keys);
      const hash = await readHash(key);

      delete hash[args[0] ?? ""];

      if (/redis\.call\("HLEN"/.test(script) && Object.keys(hash).length === 0) {
        await deleteEntry(key);
      } else {
        await writeHash(key, hash, script, args);
      }

      if (/return\s+redis\.call\("HGETALL"/.test(script)) {
        return toHashArray(hash) as TResult;
      }

      return 1 as TResult;
    }

    if (/redis\.call\("HGETALL"/.test(script)) {
      return toHashArray(await readHash(getFirstKey(keys))) as TResult;
    }

    if (/redis\.call\("HGET"/.test(script)) {
      const hash = await readHash(getFirstKey(keys));

      return (hash[args[0] ?? ""] ?? null) as TResult;
    }

    if (/redis\.call\("SET"/.test(script)) {
      await writeEntry(
        getFirstKey(keys),
        withExpiry({ kind: "string", value: args[0] ?? "", version: 1 }, script, args, now),
      );

      return 1 as TResult;
    }

    if (/redis\.call\("GET"/.test(script)) {
      const entry = await readEntry(getFirstKey(keys));

      return (entry?.kind === "string" ? entry.value : null) as TResult;
    }

    if (/redis\.call\("DEL"/.test(script)) {
      await deleteEntry(getFirstKey(keys));

      return (/return\s+\{\}/.test(script) ? [] : 1) as TResult;
    }

    if (/redis\.call\("LPUSH"/.test(script)) {
      const key = getFirstKey(keys);
      const value = args[0] ?? "";
      const list = (await readList(key)).filter((item) => item !== value);

      list.unshift(value);
      await writeList(key, lrange(list, args[1]), script, args);

      return lrange(list, args[1]) as TResult;
    }

    if (/redis\.call\("LREM"/.test(script)) {
      const key = getFirstKey(keys);
      const list = (await readList(key)).filter((item) => item !== (args[0] ?? ""));

      await writeList(key, list, script, args);

      return lrange(list, args[1]) as TResult;
    }

    if (/redis\.call\("LRANGE"/.test(script)) {
      return lrange(await readList(getFirstKey(keys)), args[0]) as TResult;
    }

    throw new Error("EdgeOne KV adapter does not support this storage script.");
  };

  return {
    async del(key) {
      await deleteEntry(buildItemKey(options.namespace, key));
    },
    async get(key) {
      const entry = await readEntry(buildItemKey(options.namespace, key));

      if (entry?.kind !== "json") {
        return null;
      }

      return JSON.parse(entry.value) as TValue;
    },
    script: runScript,
    async set(key, value) {
      await writeEntry(buildItemKey(options.namespace, key), {
        kind: "json",
        value: JSON.stringify(value),
        version: 1,
      });
    },
  };
};
