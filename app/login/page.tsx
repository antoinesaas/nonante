import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { getUser, safeNext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.auth.title, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next, "/app");
  const [{ user }, { m }] = await Promise.all([getUser(), getI18n()]);
  if (user) redirect(next);
  const t = m.auth;

  return (
    <div className="min-h-dvh grain">
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo />
        </Link>
        <div className="my-auto py-16">
          <Hand className="animate-rise text-3xl text-mute">{t.hand}</Hand>
          <h1 className="mt-3 animate-rise font-serif text-5xl leading-none [animation-delay:80ms]">{t.heading}</h1>
          <p className="mt-5 animate-rise text-paper/80 [animation-delay:140ms]">{t.text}</p>
          {params.erreur === "lien" ? (
            <p role="alert" className="mt-6 text-sm">
              {t.errorLink}
            </p>
          ) : params.erreur === "oauth" || params.erreur === "google" ? (
            <p role="alert" className="mt-6 text-sm">
              {t.errorOauth}
            </p>
          ) : null}
          <div className="mt-10 animate-rise [animation-delay:200ms]">
            <LoginForm next={next} />
          </div>
          <p className="mt-10 text-sm text-mute">
            {t.noArc}{" "}
            <Link href="/onboarding" className="text-paper underline underline-offset-4">
              {t.buildYours}
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
