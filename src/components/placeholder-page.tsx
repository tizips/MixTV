import { env } from "@/shared/env";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-12 text-center text-foreground md:px-6 lg:px-8">
      <p className="mb-3 text-sm uppercase tracking-[0.3em] text-accent">
        {env.NEXT_PUBLIC_SITE_NAME}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
        {description}
      </p>
    </section>
  );
}
