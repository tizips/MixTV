import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

type LoginResponse = {
  jwt: string;
};

type AccountResponse = {
  admin: boolean;
  id: string;
  name: string;
};

function parseLoginResponse(payload: unknown): LoginResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { jwt } = payload as {
    jwt?: unknown;
  };

  if (typeof jwt !== "string" || !jwt) {
    return null;
  }

  return { jwt };
}

function parseAccountResponse(payload: unknown): AccountResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { admin, id, name } = payload as {
    admin?: unknown;
    id?: unknown;
    name?: unknown;
  };

  if (typeof admin !== "boolean" || typeof id !== "string" || typeof name !== "string") {
    return null;
  }

  if (!id || !name) {
    return null;
  }

  return { admin, id, name };
}

function getAuthOrigin(request: Request): string {
  const url = new URL(request.url);

  if (url.origin !== "null") {
    return url.origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (!host) {
    throw new Error("Unable to resolve auth origin for account lookup.");
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

async function loginFromApi(
  request: Request,
  input: { password: string; username: string },
): Promise<LoginResponse | null> {
  const response = await fetch(new URL("/api/login", getAuthOrigin(request)), {
    body: JSON.stringify(input),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    return null;
  }

  return parseLoginResponse(await response.json());
}

async function getAccountFromApi(request: Request, jwt: string): Promise<AccountResponse | null> {
  const response = await fetch(new URL("/api/account", getAuthOrigin(request)), {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${jwt}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    return null;
  }

  return parseAccountResponse(await response.json());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.admin = user.admin;
        token.id = user.id;
        token.name = user.name;
      }

      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        accessToken:
          typeof token.accessToken === "string"
            ? token.accessToken
            : session.user?.accessToken,
        admin: Boolean(token.admin),
        id: typeof token.id === "string" ? token.id : "",
        name: typeof token.name === "string" ? token.name : session.user?.name ?? "",
      };

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        password: { label: "Password", type: "password" },
        username: { label: "Username", type: "text" },
      },
      async authorize(credentials, request) {
        const username =
          typeof credentials.username === "string" ? credentials.username.trim() : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";

        if (!username || !password) {
          return null;
        }

        const loginResult = await loginFromApi(request, { password, username });

        if (!loginResult) {
          return null;
        }

        const user = await getAccountFromApi(request, loginResult.jwt);
        if (!user) {
          return null;
        }

        return {
          accessToken: loginResult.jwt,
          admin: user.admin,
          id: user.id,
          name: user.name,
        };
      },
      name: "Credentials",
    }),
  ],
  secret: process.env.AUTH_SECRET || "mixtv-development-auth-secret",
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
