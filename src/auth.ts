import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "@/modules/auth/server/credentials-authorize";

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
      async authorize(credentials) {
        return authorizeCredentials(credentials);
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
