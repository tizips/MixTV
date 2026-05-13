import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      accessToken?: string;
      admin: boolean;
      id: string;
      name: string;
    };
  }

  interface User {
    accessToken?: string;
    admin: boolean;
    id: string;
    name: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    admin?: boolean;
    id?: string;
    name?: string;
  }
}
