import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";

export interface ConfigFilesSubscription {
  autoUpdate: boolean;
  updatedAt: string | null;
  url: string;
}

export interface ConfigFilesContent {
  content: string;
  updatedAt: string | null;
}

export interface ConfigFilesData {
  content: ConfigFilesContent;
  subscription: ConfigFilesSubscription;
}

export type ConfigFilesStore = DbPort<ConfigFilesContent, string>;

const configFilesNamespace = "admin:config-files";
const subscriptionKey = "subscription";
const contentKey = "content";

const saveSubscriptionScript = `
redis.call("HSET", KEYS[1], "url", ARGV[1], "autoUpdate", ARGV[2], "updatedAt", ARGV[3])
return 1
`;

const readSubscriptionScript = `
return redis.call("HGETALL", KEYS[1])
`;

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;

type FetchLike = typeof fetch;

function toHashRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
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

function base58ToBytes(input: string): Uint8Array {
  const indexes = Object.fromEntries(base58Alphabet.split("").map((char, index) => [char, index]));
  const bytes = [0];

  for (const char of input) {
    const value = indexes[char];

    if (typeof value !== "number") {
      throw new Error("invalid base58 content");
    }

    let carry = value;

    for (let index = 0; index < bytes.length; index += 1) {
      const current = bytes[index] * 58 + carry;
      bytes[index] = current & 0xff;
      carry = current >> 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let index = 0; index < input.length && input[index] === "1"; index += 1) {
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}

async function decompressWith(format: CompressionFormat, bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  const input = Uint8Array.from(bytes);
  await writer.write(input);
  await writer.close();
  const output = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(output);
}

function asText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).trim();
}

async function decodeSubscriptionPayload(rawBody: string): Promise<string> {
  const body = rawBody.trim();

  if (!body) {
    throw new Error("subscription response is empty.");
  }

  if (!base58Pattern.test(body)) {
    return body;
  }

  const decoded = base58ToBytes(body);
  const directText = asText(decoded);

  if (directText) {
    return directText;
  }

  const decompressFormats: CompressionFormat[] = ["gzip", "deflate", "deflate-raw"];

  for (const format of decompressFormats) {
    try {
      const inflated = await decompressWith(format, decoded);
      const inflatedText = asText(inflated);

      if (inflatedText) {
        return inflatedText;
      }
    } catch {
      // Try next format.
    }
  }

  throw new Error("subscription payload decode failed.");
}

export function createConfigFilesStore(): ConfigFilesStore {
  return createDbAdapter<ConfigFilesContent>({
    namespace: configFilesNamespace,
  });
}

export async function getConfigFilesSubscription(
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesSubscription> {
  const record = toHashRecord(
    await store.script(readSubscriptionScript, {
      keys: [subscriptionKey],
      readOnly: true,
    }),
  );

  return {
    autoUpdate: record.autoUpdate === "true",
    updatedAt: record.updatedAt || null,
    url: record.url,
  };
}

export async function saveConfigFilesSubscription(
  subscription: Pick<ConfigFilesSubscription, "autoUpdate" | "url">,
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesSubscription> {
  const url = subscription.url.trim();

  if (!url) {
    throw new Error("subscription url is required.");
  }

  const saved: ConfigFilesSubscription = {
    autoUpdate: subscription.autoUpdate,
    updatedAt: new Date().toISOString(),
    url,
  };

  await store.script(saveSubscriptionScript, {
    args: [saved.url, saved.autoUpdate, saved.updatedAt],
    keys: [subscriptionKey],
  });

  return saved;
}

export async function saveConfigFilesSubscriptionPull(
  url: string,
  store: ConfigFilesStore = createConfigFilesStore(),
  fetchImpl: FetchLike = fetch,
): Promise<ConfigFilesSubscription> {
  const [current, response] = await Promise.all([
    getConfigFilesSubscription(store),
    fetchImpl(url, {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    }),
  ]);

  if (!response.ok) {
    throw new Error(`subscription request failed: ${response.status}`);
  }

  const rawBody = await response.text();
  const content = await decodeSubscriptionPayload(rawBody);

  await saveConfigFilesContent(content, store);

  return saveConfigFilesSubscription(
    {
      autoUpdate: current.autoUpdate,
      url,
    },
    store,
  );
}

export async function saveConfigFilesSubscriptionAutoUpdate(
  autoUpdate: boolean,
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesSubscription> {
  const current = await getConfigFilesSubscription(store);
  const saved: ConfigFilesSubscription = {
    autoUpdate,
    updatedAt: new Date().toISOString(),
    url: current.url ?? "",
  };

  await store.script(saveSubscriptionScript, {
    args: [saved.url, saved.autoUpdate, saved.updatedAt],
    keys: [subscriptionKey],
  });

  return saved;
}

export async function getConfigFilesContent(
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesContent> {
  const record = await store.get(contentKey);

  return record ?? {
    content: "",
    updatedAt: null,
  };
}

export async function getConfigFiles(
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesData> {
  const [subscription, content] = await Promise.all([
    getConfigFilesSubscription(store),
    getConfigFilesContent(store),
  ]);

  return {
    content,
    subscription,
  };
}

export async function saveConfigFilesContent(
  content: string,
  store: ConfigFilesStore = createConfigFilesStore(),
): Promise<ConfigFilesContent> {
  const saved = {
    content,
    updatedAt: new Date().toISOString(),
  };

  await store.set(contentKey, saved);

  return saved;
}
