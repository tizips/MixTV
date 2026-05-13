import { jwtVerify, SignJWT } from "jose";

const LOGIN_JWT_TTL_SECONDS = 15 * 24 * 60 * 60;

type LoginRequest = {
  password: string;
  username: string;
};

type LoginConfig = {
  authSecret: string;
  password: string;
  username: string;
};

type EnvLike = Record<string, string | undefined>;

type AccountInfo = {
  admin: boolean;
  id: string;
  name: string;
};

function readLoginConfig(env: EnvLike = process.env): LoginConfig {
  const username = env.USERNAME?.trim() ?? "";
  const password = env.PASSWORD ?? "";
  const authSecret = env.AUTH_SECRET ?? "";

  if (!username || !password || !authSecret) {
    throw new Error("USERNAME, PASSWORD, and AUTH_SECRET must be configured.");
  }

  return {
    authSecret,
    password,
    username,
  };
}

export async function issueLoginJwt(
  username: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({
    userId: username,
    username,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(username)
    .setIssuedAt(now)
    .setExpirationTime(now + LOGIN_JWT_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}

export async function authenticateLoginRequest(
  input: LoginRequest,
  env: EnvLike = process.env,
): Promise<{ jwt: string } | null> {
  const config = readLoginConfig(env);

  if (input.username === config.username) {
    if (input.password !== config.password) {
      return null;
    }

    return {
      jwt: await issueLoginJwt(input.username, config.authSecret),
    };
  }

  // Keep the non-env username branch here for later extension.
  return null;
}

export async function getAccountByJwt(
  jwt: string,
  env: EnvLike = process.env,
): Promise<AccountInfo | null> {
  const config = readLoginConfig(env);

  try {
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode(config.authSecret));
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    const username = typeof payload.username === "string" ? payload.username : "";

    if (!subject || !userId || !username) {
      return null;
    }

    return {
      admin: username === config.username,
      id: userId,
      name: username === config.username ? "管理员" : username,
    };
  } catch {
    return null;
  }
}

export { LOGIN_JWT_TTL_SECONDS };
