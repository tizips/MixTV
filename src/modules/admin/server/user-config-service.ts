import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";
import {
  usernamePattern,
  usernamePatternMessage,
  userPasswordPattern,
  userPasswordPatternMessage,
} from "@/shared/user-credentials";

export class UserConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserConfigValidationError";
  }
}

export type UserRole = "owner" | "user";
export type UserStatus = "active" | "banned";

export interface UserItem {
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string | null;
}

export interface UserCollection {
  users: UserItem[];
  updatedAt: string | null;
}

export type UserConfigStore = DbPort<unknown, string>;

type StoredUserRecord = UserItem & {
  passwordHash?: string;
};

type UserPatch = {
  password?: string;
  role?: UserRole;
  status?: UserStatus;
};

const storeNamespace = "admin";
const usersKey = "users";

const userRoles = new Set<UserRole>(["owner", "user"]);
const userStatuses = new Set<UserStatus>(["active", "banned"]);
const passwordHashAlgorithm = "pbkdf2-sha256";
const passwordHashIterations = 100_000;
const passwordSaltBytes = 16;
const passwordHashBits = 256;

const readUsersScript = `
return redis.call("HGETALL", KEYS[1])
`;

const saveUserScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return 1
`;

const deleteUserScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return 1
`;

export function createUserConfigStore(): UserConfigStore {
  return createDbAdapter<unknown>({ namespace: storeNamespace });
}

function now() {
  return new Date().toISOString();
}

function asObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new UserConfigValidationError("Request body must be an object.");
  }

  return payload as Record<string, unknown>;
}

function readPatchObjects(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) {
    return [asObject(payload)];
  }

  if (payload.length === 0) {
    throw new UserConfigValidationError("user patch is required.");
  }

  return payload.map(asObject);
}

function readString(payload: Record<string, unknown>, key: string): string;
function readString(payload: Record<string, unknown>, key: string, required: false): string | undefined;
function readString(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "string") {
    if (!required) {
      return undefined;
    }

    throw new UserConfigValidationError(`${key} is required.`);
  }

  return value.trim();
}

function readConfiguredAdminUsername() {
  return process.env.USERNAME?.trim() ?? "";
}

function validateUsername(username: string) {
  if (!usernamePattern.test(username)) {
    throw new UserConfigValidationError(usernamePatternMessage);
  }
}

function validatePassword(password: string) {
  if (!userPasswordPattern.test(password)) {
    throw new UserConfigValidationError(userPasswordPatternMessage);
  }
}

function parseUserPatch(input: unknown): UserPatch {
  const patches = readPatchObjects(input);
  const patch: UserPatch = {};
  const allowedKeys = new Set(["password", "role", "status"]);

  for (const item of patches) {
    for (const key of Object.keys(item)) {
      if (!allowedKeys.has(key)) {
        throw new UserConfigValidationError("user patch key is invalid.");
      }
    }

    if ("role" in item) {
      if (!isOneOf(item.role, userRoles)) {
        throw new UserConfigValidationError("role is invalid.");
      }

      patch.role = item.role;
    }

    if ("status" in item) {
      if (!isOneOf(item.status, userStatuses)) {
        throw new UserConfigValidationError("status is invalid.");
      }

      patch.status = item.status;
    }

    if ("password" in item) {
      if (typeof item.password !== "string" || !item.password.trim()) {
        throw new UserConfigValidationError("password is required.");
      }

      patch.password = item.password.trim();
      validatePassword(patch.password);
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new UserConfigValidationError("user patch is required.");
  }

  return patch;
}

function isOneOf<T extends string>(value: unknown, values: Set<T>): value is T {
  return typeof value === "string" && values.has(value as T);
}

function toBase64(bytes: Uint8Array<ArrayBuffer>) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations,
      name: "PBKDF2",
      salt,
    },
    key,
    passwordHashBits,
  );

  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array<ArrayBuffer>, right: Uint8Array<ArrayBuffer>) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes));
  const hash = await derivePasswordHash(password, salt, passwordHashIterations);

  return `${passwordHashAlgorithm}$${passwordHashIterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPasswordHash(password: string, storedHash: string) {
  const [algorithm, rawIterations, rawSalt, rawHash] = storedHash.split("$");
  const iterations = Number(rawIterations);

  if (algorithm !== passwordHashAlgorithm || !Number.isSafeInteger(iterations) || iterations <= 0 || !rawSalt || !rawHash) {
    return false;
  }

  try {
    const salt = fromBase64(rawSalt);
    const expectedHash = fromBase64(rawHash);
    const actualHash = await derivePasswordHash(password, salt, iterations);

    return constantTimeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
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

function toPublicUser(user: StoredUserRecord): UserItem {
  return {
    createdAt: user.createdAt,
    role: user.role,
    status: user.status,
    updatedAt: user.updatedAt,
    username: user.username,
  };
}

function parseStoredUsers(record: Record<string, string>): StoredUserRecord[] {
  return Object.entries(record)
    .map(([username, rawUser]) => {
      try {
        const user = JSON.parse(rawUser) as Partial<StoredUserRecord>;

        if (
          user.username !== username ||
          !isOneOf(user.role, userRoles) ||
          !isOneOf(user.status, userStatuses) ||
          typeof user.createdAt !== "string"
        ) {
          return null;
        }

        return {
          createdAt: user.createdAt,
          role: user.role,
          status: user.status,
          updatedAt: typeof user.updatedAt === "string" ? user.updatedAt : null,
          username: user.username,
          ...(typeof user.passwordHash === "string" ? { passwordHash: user.passwordHash } : {}),
        };
      } catch {
        return null;
      }
    })
    .filter((user): user is StoredUserRecord => user !== null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.username.localeCompare(right.username));
}

function getUsersUpdatedAt(users: UserItem[]) {
  return users.reduce<string | null>((latest, user) => {
    const timestamp = user.updatedAt ?? user.createdAt;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);
}

async function readStoredUsers(store: UserConfigStore): Promise<StoredUserRecord[]> {
  return parseStoredUsers(
    toHashRecord(
      await store.script(readUsersScript, {
        keys: [usersKey],
        readOnly: true,
      }),
    ),
  );
}

async function saveUserRecord(user: StoredUserRecord, store: UserConfigStore) {
  await store.script(saveUserScript, {
    args: [user.username, JSON.stringify(user)],
    keys: [usersKey],
  });
}

async function saveUserRecords(users: StoredUserRecord[], store: UserConfigStore) {
  for (const user of users) {
    await saveUserRecord(user, store);
  }
}

function toUserCollection(users: StoredUserRecord[]): UserCollection {
  return {
    updatedAt: getUsersUpdatedAt(users),
    users: users.map(toPublicUser),
  };
}

async function getCurrentUsers(store: UserConfigStore): Promise<StoredUserRecord[]> {
  return readStoredUsers(store);
}

export async function getUsers(store: UserConfigStore = createUserConfigStore()): Promise<UserCollection> {
  const users = await readStoredUsers(store);
  return toUserCollection(users);
}

export async function createUser(input: unknown, store: UserConfigStore = createUserConfigStore()): Promise<UserItem> {
  const payload = asObject(input);
  const username = readString(payload, "username");
  const password = readString(payload, "password");
  const role = payload.role;
  const status = payload.status;

  if (!password) {
    throw new UserConfigValidationError("password is required.");
  }
  validateUsername(username);
  validatePassword(password);
  if (!isOneOf(role, userRoles)) {
    throw new UserConfigValidationError("role is invalid.");
  }
  if (!isOneOf(status, userStatuses)) {
    throw new UserConfigValidationError("status is invalid.");
  }
  if (username === readConfiguredAdminUsername()) {
    throw new UserConfigValidationError("username conflicts with the configured admin user.");
  }

  const current = await getUsers(store);
  if (current.users.some((user) => user.username === username)) {
    throw new UserConfigValidationError("username already exists.");
  }

  const createdAt = now();
  const user: StoredUserRecord = {
    username,
    passwordHash: await hashPassword(password),
    role,
    status,
    createdAt,
    updatedAt: null,
  };
  await saveUserRecords([...(await getCurrentUsers(store)), user], store);
  return toPublicUser(user);
}

export async function updateUser(
  username: string,
  input: unknown,
  store: UserConfigStore = createUserConfigStore(),
): Promise<UserCollection> {
  const patch = parseUserPatch(input);
  const current = await getCurrentUsers(store);
  const user = current.find((item) => item.username === username);

  if (!user) {
    throw new UserConfigValidationError("user not found.");
  }

  const updated: StoredUserRecord = {
    ...user,
    ...(patch.role ? { role: patch.role } : {}),
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.password ? { passwordHash: await hashPassword(patch.password) } : {}),
    updatedAt: now(),
  };
  const users = current.map((item) => (item.username === username ? updated : item));
  await saveUserRecords(users, store);

  return toUserCollection(users);
}

export async function updateUserPassword(
  username: string,
  input: unknown,
  store: UserConfigStore = createUserConfigStore(),
): Promise<UserCollection> {
  const payload = asObject(input);
  return updateUser(username, [{ password: readString(payload, "password") }], store);
}

export async function verifyUserPassword(
  username: string,
  password: string,
  store: UserConfigStore = createUserConfigStore(),
): Promise<boolean> {
  const current = await getCurrentUsers(store);
  const user = current.find((item) => item.username === username);

  if (!user?.passwordHash) {
    return false;
  }

  return verifyPasswordHash(password, user.passwordHash);
}

export async function deleteUser(
  username: string,
  store: UserConfigStore = createUserConfigStore(),
): Promise<UserCollection> {
  const current = await getCurrentUsers(store);

  if (!current.some((user) => user.username === username)) {
    throw new UserConfigValidationError("user not found.");
  }

  await store.script(deleteUserScript, {
    args: [username],
    keys: [usersKey],
  });

  const users = current.filter((user) => user.username !== username);
  await saveUserRecords(users, store);

  return toUserCollection(users);
}
