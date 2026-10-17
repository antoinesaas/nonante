import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { ActivityRings } from "@/components/ActivityRings";
import { Aura } from "@/components/Aura";
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
    <div className="relative isolate min-h-dvh overflow-hidden">
      <Aura tone="violet" className="h-[34rem] opacity-60" />
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo />
        </Link>
        <div className="my-auto py-12">
          <ActivityRings
            rings={[
              { value: 0.8, max: 1, tone: "rose" },
              { value: 0.6, max: 1, tone: "mint" },
              { value: 0.4, max: 1, tone: "sky" },
            ]}
            size={96}
            stroke={10}
            gap={3}
            label=""
            className="animate-pop"
          />
          <p className="mt-8 animate-in bg-linear-to-r from-rose via-violet to-sky bg-clip-text text-[15px] font-semibold text-transparent">{t.hand}</p>
          <h1 className="mt-2 animate-in font-display text-[40px] leading-[1.02] [animation-delay:80ms]">{t.heading}</h1>
          <p className="mt-4 animate-in text-paper/80 [animation-delay:140ms]">{t.text}</p>
          {params.erreur === "lien" ? (
            <p role="alert" className="mt-6 text-sm">
              {t.errorLink}
            </p>
          ) : params.erreur === "oauth" || params.erreur === "google" ? (
            <p role="alert" className="mt-6 text-sm">
              {t.errorOauth}
            </p>
          ) : null}
          <div className="mt-10 animate-in [animation-delay:200ms]">
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
