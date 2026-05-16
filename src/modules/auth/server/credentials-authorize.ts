import {
  authenticateLoginRequest,
  getAccountByJwt,
} from "@/modules/auth/server/login-api-service";

type EnvLike = Record<string, string | undefined>;

type CredentialsInput = Partial<Record<"password" | "username", unknown>>;

export async function authorizeCredentials(
  credentials: CredentialsInput,
  env: EnvLike = process.env,
) {
  const username = typeof credentials.username === "string" ? credentials.username.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";

  if (!username || !password) {
    return null;
  }

  const loginResult = await authenticateLoginRequest({ password, username }, env);

  if (!loginResult) {
    return null;
  }

  const user = await getAccountByJwt(loginResult.jwt, env);

  if (!user) {
    return null;
  }

  return {
    accessToken: loginResult.jwt,
    admin: user.admin,
    id: user.id,
    name: user.name,
  };
}
