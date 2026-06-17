import { resolveSafeNextPath } from "@/modules/auth";
import { LoginForm } from "@/modules/auth/ui/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = resolveSafeNextPath(nextParam);

  return <LoginForm nextPath={nextPath} />;
}
