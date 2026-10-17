import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aura } from "@/components/Aura";
import { NewPrinciple, PrincipleNotice, PrincipleRow, TemplateLibrary } from "@/components/PrincipleEditor";
import { requireUser } from "@/lib/auth";
import { fmt, formatDay } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { MyPrinciples, PlanId } from "@/lib/types";
import { btnPrimary, label, largeTitle, sectionTitle } from "@/lib/ui";
import { RegenerateButton } from "./RegenerateButton";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.principles.title };
}

export default async function PrinciplesPage({ searchParams }: PageProps<"/app/principes">) {
  const [{ supabase }, { m, locale }, params] = await Promise.all([requireUser("/app/principes"), getI18n(), searchParams]);
  const t = m.app.principles;
  // Arc écrit dans une autre langue que celle affichée : traduit avant lecture.
  const { data: arc } = await supabase.from("enrollments").select("locale").in("status", ["draft", "active"]).maybeSingle();
  if (arc && arc.locale !== locale) await supabase.rpc("set_my_locale", { p_locale: locale });
  const { data, error } = await supabase.rpc("my_principles");
  if (error) throw new Error(`Principes indisponibles (${error.code})`);
  const d = data as MyPrinciples;
  if (!d.enrollment) redirect("/onboarding");

  const principles = d.principles ?? [];
  const limits = d.limits!;
  const editable = Boolean(d.editable);
  const draft = d.enrollment.status === "draft";
  const beforeStart = draft || !d.started;
  const fresh = params.nouveau === "1";

  return (
    <>
      <Aura tone="violet" />
      <header className="relative z-10 animate-in pt-2">
        <p className={label}>{m.game.goals[d.enrollment.goal_type].label}</p>
        <h1 className={`mt-1 ${largeTitle}`}>{fresh ? t.titleFresh : t.title}</h1>
        <p className="mt-2 text-[15px] leading-snug text-paper/80">{d.enrollment.goal_title}</p>
      </header>

      <div className="relative z-10 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <div>
          <p className="mt-3 text-sm text-mute">
            {fresh ? t.introFresh : beforeStart ? fmt(t.introBefore, { date: formatDay(d.enrollment.start_date, locale, { weekday: true }) }) : t.introRunning}
          </p>

          <div className="mt-6 flex items-center justify-between gap-4 text-sm">
            <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-mute tabular-nums">
              {fmt(t.count, { n: principles.length, max: limits.max_principles })}
              {d.plan ? fmt(t.plan, { plan: m.game.plans.name[d.plan as PlanId] }) : ""}
            </span>
            {beforeStart && editable ? <RegenerateButton /> : null}
          </div>

          <PrincipleNotice />
          <ul className="mt-4 space-y-2.5">
            {principles.map((p) => (
              <PrincipleRow key={p.id} principle={p} editable={editable} />
            ))}
          </ul>

          {editable ? (
            <div className="mt-5">
              {principles.length < limits.max_principles ? (
                <NewPrinciple />
              ) : (
                <p className="card p-4 text-sm">
                  {fmt(t.limit, { n: limits.max_principles })}{" "}
                  {limits.max_principles < 12 ? (
                    <Link href="/abonnement" className="underline underline-offset-4">
                      {t.goPro}
                    </Link>
                  ) : (
                    t.removeOne
                  )}
                </p>
              )}
            </div>
          ) : null}

          {draft ? (
            <div className="glow-violet mt-8 rounded-[1.75rem] p-5">
              <p className="font-display text-[22px] leading-tight">{t.readyTitle}</p>
              <p className="mt-2 text-sm text-paper/85">
                {t.readyText}
                {principles.length > 6 ? t.readyKeep : ""}
              </p>
              <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
                {t.choosePlan}
              </Link>
            </div>
          ) : fresh ? (
            <Link href="/app" className={`${btnPrimary} mt-8`}>
              {t.go}
            </Link>
          ) : null}

        </div>

        {editable ? (
          <section className="mt-12 lg:mt-6">
            <h2 className={sectionTitle}>{t.library}</h2>
            <p className="mt-2 text-sm text-mute">{t.libraryHint}</p>
            <div className="mt-6">
              <TemplateLibrary templates={d.templates ?? []} full={principles.length >= limits.max_principles ? fmt(t.full, { n: limits.max_principles }) : null} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
