import { encode } from "next-auth/jwt";

export const authSessionSecret = "mixtv-development-auth-secret";

const authSessionCookieMaxAgeSeconds = 30 * 24 * 60 * 60;
const authSessionCookiePath = "/";
const authSessionCookieSameSite = "lax" as const;
const authSessionCookieName = "authjs.session-token";
const secureAuthSessionCookieName = `__Secure-${authSessionCookieName}`;

type AuthSessionUser = {
  accessToken: string;
  admin: boolean;
  id: string;
  name: string;
};

function readForwardedProtocol(request: Request) {
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ?? "";
}

function shouldUseSecureAuthCookie(request: Request) {
  const forwardedProtocol = readForwardedProtocol(request);

  if (forwardedProtocol) {
    return forwardedProtocol === "https";
  }

  return new URL(request.url).protocol === "https:";
}

function getAuthSessionCookieName(secure: boolean) {
  return secure ? secureAuthSessionCookieName : authSessionCookieName;
}

export function createExpiredAuthSessionCookies() {
  return [
    {
      name: authSessionCookieName,
      options: {
        httpOnly: true,
        maxAge: 0,
        path: authSessionCookiePath,
        sameSite: authSessionCookieSameSite,
        secure: false,
      },
      value: "",
    },
    {
      name: secureAuthSessionCookieName,
      options: {
        httpOnly: true,
        maxAge: 0,
        path: authSessionCookiePath,
        sameSite: authSessionCookieSameSite,
        secure: true,
      },
      value: "",
    },
  ] as const;
}

export async function createAuthSessionCookie(request: Request, user: AuthSessionUser) {
  const secure = shouldUseSecureAuthCookie(request);
  const name = getAuthSessionCookieName(secure);
  const value = await encode({
    salt: name,
    secret: authSessionSecret,
    token: {
      accessToken: user.accessToken,
      admin: user.admin,
      id: user.id,
      name: user.name,
      sub: user.id,
    },
  });

  return {
    name,
    options: {
      httpOnly: true,
      maxAge: authSessionCookieMaxAgeSeconds,
      path: authSessionCookiePath,
      sameSite: authSessionCookieSameSite,
      secure,
    },
    value,
  };
}
