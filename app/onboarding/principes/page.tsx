import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeCustomPrinciple } from "@/app/actions/onboarding";
import { CustomPrincipleForm } from "@/app/onboarding/principes/CustomPrincipleForm";
import { Logo } from "@/components/Logo";
import { PrincipleList } from "@/components/PrincipleList";
import { requireUser } from "@/lib/auth";
import { formatDayFr, todayParis } from "@/lib/dates";
import { btnLink, btnPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "Tes principes", robots: { index: false } };

export default async function PrinciplesPage() {
  const { supabase, user } = await requireUser("/onboarding/principes");

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, cohort_id, started_on, created_at")
    .eq("user_id", user.id)
    .in("status", ["pending_payment", "active"])
    .order("created_at", { ascending: false });
  const enrollment = enrollments?.find((e) => e.status === "pending_payment") ?? enrollments?.[0];
  if (!enrollment) redirect("/onboarding");

  const [{ data: cohort }, { data: principles }] = await Promise.all([
    supabase.from("cohorts").select("name, start_date").eq("id", enrollment.cohort_id).single(),
    supabase
      .from("principles")
      .select("id, if_text, then_text, proof_type, difficulty, max_difficulty, days, source, position")
      .eq("enrollment_id", enrollment.id)
      .order("position"),
  ]);
  if (!cohort) redirect("/onboarding");

  const pending = enrollment.status === "pending_payment";
  const editable = pending || todayParis() < (enrollment.started_on ?? cohort.start_date);
  const custom = (principles ?? []).find((p) => p.source === "custom");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-6 pb-16">
      <Logo size="sm" />
      <p className="mt-14 text-xs tracking-[0.2em] text-mute uppercase">{cohort.name}</p>
      <h1 className="mt-4 font-serif text-5xl leading-none">Tes principes.</h1>
      <p className="mt-5 leading-relaxed text-mute">
        Imposés par l&apos;app : la difficulté et la preuve ne se négocient pas. Départ le{" "}
        {formatDayFr(cohort.start_date, { weekday: true })}.
      </p>

      <div className="mt-10">
        <PrincipleList principles={principles ?? []} />
      </div>

      {editable ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Un principe à toi ?</h2>
          <p className="mt-2 text-sm text-mute">
            Facultatif. Toujours en difficulté 1, preuve déclarative, tous les jours. Modifiable jusqu&apos;au départ.
          </p>
          {custom ? (
            <form action={removeCustomPrinciple} className="mt-4">
              <button type="submit" className={btnLink}>
                Retirer mon principe perso
              </button>
            </form>
          ) : (
            <CustomPrincipleForm />
          )}
        </section>
      ) : null}

      <div className="mt-12">
        {pending ? (
          <Link href="/checkout" className={btnPrimary}>
            Continuer vers le paiement
          </Link>
        ) : (
          <Link href="/app" className={btnPrimary}>
            Retour au tableau de bord
          </Link>
        )}
        {pending ? (
          <Link href="/onboarding" className={`${btnLink} mt-4 inline-block`}>
            Modifier mes réponses
          </Link>
        ) : null}
      </div>
    </main>
  );
}
