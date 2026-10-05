import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OnboardingFlow, type OnboardingPrefill } from "@/app/onboarding/OnboardingFlow";
import { Logo } from "@/components/Logo";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getArt, ONBOARDING_ART } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { PUBLIC_COHORT_COLUMNS } from "@/lib/cohorts";
import { todayParis } from "@/lib/dates";

export const metadata: Metadata = { title: "Ton arc", robots: { index: false } };

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { supabase, user } = await requireUser("/onboarding");
  const params = await searchParams;
  const today = todayParis();

  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("pseudo, is_public").eq("id", user.id).maybeSingle(),
    supabase
      .from("enrollments")
      .select("id, cohort_id, status, category, goal_title, goal_public, weak_moments, wake_time, pushups")
      .eq("user_id", user.id),
  ]);

  // Déjà un arc actif qui n'est pas terminé : direction le tableau de bord.
  const active = (enrollments ?? []).filter((e) => e.status === "active");
  if (active.length) {
    const { data: activeCohorts } = await supabase
      .from("cohorts")
      .select("id, end_date")
      .in("id", active.map((e) => e.cohort_id));
    if ((activeCohorts ?? []).some((c) => c.end_date >= today)) redirect("/app");
  }

  // Cohorte demandée explicitement (lien de test), sinon le prochain arc ouvert.
  const requested = z.uuid().safeParse(params.cohorte);
  let query = supabase.from("cohorts").select(PUBLIC_COHORT_COLUMNS).eq("enroll_open", true).gte("start_date", addDays(today, -6));
  query = requested.success ? query.eq("id", requested.data) : query.eq("is_test", false);
  const { data: cohort } = await query.order("start_date", { ascending: true }).limit(1).maybeSingle();

  if (!cohort) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-6 pb-12">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo />
        </Link>
        <h1 className="mt-20 font-serif text-5xl leading-none">Aucun arc ouvert pour l&apos;instant.</h1>
        <p className="mt-5 text-mute">Laisse ton email : tu seras prévenu à l&apos;ouverture.</p>
        <div className="mt-8">
          <WaitlistForm cohortId={null} cta="Me prévenir" />
        </div>
      </main>
    );
  }

  const pending = (enrollments ?? []).find((e) => e.cohort_id === cohort.id && e.status === "pending_payment");
  const prefill: OnboardingPrefill | null = pending
    ? {
        category: pending.category as OnboardingPrefill["category"],
        goal: pending.goal_title,
        goalPublic: pending.goal_public,
        weakMoments: pending.weak_moments,
        wakeTime: pending.wake_time.slice(0, 5),
        pushups: pending.pushups as OnboardingPrefill["pushups"],
      }
    : null;

  return (
    <OnboardingFlow
      cohort={cohort}
      profile={profile ?? null}
      prefill={prefill}
      firstArt={getArt(ONBOARDING_ART.first)}
      lastArt={getArt(ONBOARDING_ART.last)}
      currentYear={Number(today.slice(0, 4))}
    />
  );
}
