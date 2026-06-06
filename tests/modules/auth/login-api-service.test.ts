import { jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  authenticateLoginRequest,
  getAccountByJwt,
  issueLoginJwt,
  LOGIN_JWT_TTL_SECONDS,
} from "@/modules/auth/server/login-api-service";
import { resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";

class FakeEnvKvBinding implements EdgeOneKvBinding {
  constructor(private readonly values: Record<string, string>) {}

  async delete(key: string) {
    delete this.values[key];
  }

  async get(key: string) {
    return this.values[key] ?? null;
  }

  async list() {
    return {
      keys: Object.keys(this.values).map((name) => ({ name })),
      list_complete: true,
    };
  }

  async put(key: string, value: string) {
    this.values[key] = value;
  }
}

describe("authenticateLoginRequest", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env;
    resetRuntimeEnvCacheForTest();
  });

  it("reads login config from the EdgeOne env KV binding when no env is provided", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      AUTH_SECRET: "kv-jwt-secret",
      PASSWORD: "secret@pass",
      USERNAME: "admin",
    });

    const result = await authenticateLoginRequest({
      password: "secret@pass",
      username: "admin",
    });

    expect(result).not.toBeNull();

    const { payload } = await jwtVerify(
      result!.jwt,
      new TextEncoder().encode("kv-jwt-secret"),
    );

    expect(payload.username).toBe("admin");
  });

  it("reads login config from lowercase remote KV env keys", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      auth_secret: "kv-jwt-secret",
      password: "secret@pass",
      username: "admin",
    });

    const result = await authenticateLoginRequest({
      password: "secret@pass",
      username: "admin",
    });

    expect(result).not.toBeNull();

    const { payload } = await jwtVerify(
      result!.jwt,
      new TextEncoder().encode("kv-jwt-secret"),
    );

    expect(payload.username).toBe("admin");
  });

  it("returns a signed jwt when username and password match env config", async () => {
    const result = await authenticateLoginRequest(
      {
        password: "secret@pass",
        username: "admin",
      },
      {
        AUTH_SECRET: "jwt-secret",
        PASSWORD: "secret@pass",
        USERNAME: "admin",
      },
    );

    expect(result).not.toBeNull();
    expect(result?.jwt.split(".")).toHaveLength(3);

    const { payload, protectedHeader } = await jwtVerify(
      result!.jwt,
      new TextEncoder().encode("jwt-secret"),
    );

    expect(protectedHeader.alg).toBe("HS256");
    expect(protectedHeader.typ).toBe("JWT");
    expect(payload.sub).toBe("admin");
    expect(payload.userId).toBe("admin");
    expect(payload.username).toBe("admin");
    expect(Number(payload.exp) - Number(payload.iat)).toBe(LOGIN_JWT_TTL_SECONDS);
  });

  it("returns null when password does not match", async () => {
    const result = await authenticateLoginRequest(
      {
        password: "wrong-pass",
        username: "admin",
      },
      {
        AUTH_SECRET: "jwt-secret",
        PASSWORD: "secret@pass",
        USERNAME: "admin",
      },
    );

    expect(result).toBeNull();
  });

  it("returns null for usernames outside the env-backed branch", async () => {
    const result = await authenticateLoginRequest(
      {
        password: "secret@pass",
        username: "editor",
      },
      {
        AUTH_SECRET: "jwt-secret",
        PASSWORD: "secret@pass",
        USERNAME: "admin",
      },
    );

    expect(result).toBeNull();
  });

  it("throws when required env config is missing", async () => {
    await expect(
      authenticateLoginRequest(
        {
          password: "secret@pass",
          username: "admin",
        },
        {
          AUTH_SECRET: "",
          PASSWORD: "secret@pass",
          USERNAME: "admin",
        },
      ),
    ).rejects.toThrow("USERNAME, PASSWORD, and AUTH_SECRET must be configured.");
  });
});

describe("issueLoginJwt", () => {
  it("uses the provided timestamp for deterministic expiry", async () => {
    const jwt = await issueLoginJwt("tester", "jwt-secret", 1_700_000_000);
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode("jwt-secret"), {
      currentDate: new Date(1_700_000_000 * 1000),
    });

    expect(payload.iat).toBe(1_700_000_000);
    expect(payload.exp).toBe(1_700_000_000 + LOGIN_JWT_TTL_SECONDS);
  });
});

describe("getAccountByJwt", () => {
  it("returns account info for a valid token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = await issueLoginJwt("admin", "jwt-secret", now);
    const account = await getAccountByJwt(jwt, {
      AUTH_SECRET: "jwt-secret",
      PASSWORD: "secret@pass",
      USERNAME: "admin",
    });

    expect(account).toEqual({
      admin: true,
      id: "admin",
      name: "管理员",
    });
  });

  it("returns null for an invalid token", async () => {
    const account = await getAccountByJwt("invalid-token", {
      AUTH_SECRET: "jwt-secret",
      PASSWORD: "secret@pass",
      USERNAME: "admin",
    });

    expect(account).toBeNull();
  });
});
