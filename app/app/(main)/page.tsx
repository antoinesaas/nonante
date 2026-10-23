import Link from "next/link";
import { todayParis } from "@/lib/dates";
import { TrialButton } from "@/components/TrialButton";
import { redirect } from "next/navigation";
import { JokerButton, StartTodayButton } from "@/app/app/(main)/DayActions";
import { ReferralRow } from "@/app/app/(main)/ReferralRow";
import { ActivityRings, RING_TEXT } from "@/components/ActivityRings";
import { Aura } from "@/components/Aura";
import { CalendarInteractive } from "@/components/CalendarInteractive";
import { CelebrationOverlay } from "@/components/Celebration";
import { Countdown } from "@/components/Countdown";
import { CalendarLegend } from "@/components/DotCalendar";
import { Avatar } from "@/components/Player";
import { QuoteCard } from "@/components/QuoteCard";
import { TodayPrinciple } from "@/components/TodayPrinciple";
import { WeekRings } from "@/components/WeekRings";
import { requireUser } from "@/lib/auth";
import { parisMidnight } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { INTL } from "@/lib/i18n/config";
import { fmt, formatDay, formatMoney, formatNumber, formatPoints, signed } from "@/lib/i18n/format";
import { bareThen, daysLabel, titleFor } from "@/lib/i18n/labels";
import type { Messages } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { fulfillCheckout } from "@/lib/payments";
import { ARC_COMPLETION } from "@/lib/rules";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import type { ChallengeView, Dashboard, PrincipleView, Target, WeekDay } from "@/lib/types";
import { btnPrimary, btnSmall, label, sectionTitle } from "@/lib/ui";

const WIDTHS = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];

function serverNow(): number {
  return Date.now();
}

function challengeProgress(c: ChallengeView, t: Messages["app"]["today"]): string {
  const { current, goal } = c.progress;
  switch (c.rule.type) {
    case "session_minutes":
      return fmt(t.hoursOf, { h: Math.floor(current / 60), m: String(current % 60).padStart(2, "0"), goal: Math.floor(goal / 60) });
    case "declaratif":
    case "photo":
    case "green_day":
    case "wake":
      return current >= goal ? t.proven : t.toProveShort;
    default:
      return `${current} / ${goal}`;
  }
}

/** Salutation selon l'heure de Paris. */
function greeting(t: Messages["app"]["today"]): string {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 5 || hour >= 18 ? t.evening : hour < 12 ? t.morning : t.afternoon;
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-mute" aria-hidden="true">
      <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const [{ supabase, user }, { m, locale }, params] = await Promise.all([requireUser("/app"), getI18n(), searchParams]);
  const t = m.app.today;

  // Retour de Stripe : on synchronise tout de suite, sans attendre le webhook (idempotent).
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  if (params.paid === "1" && sessionId && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) && stripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id === user.id) await fulfillCheckout(session);
    } catch (e) {
      console.error(`[app] vérification du paiement impossible : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }

  const [{ data, error }, { data: weekData }] = await Promise.all([supabase.rpc("my_dashboard"), supabase.rpc("my_week")]);
  if (error) throw new Error(`Tableau de bord indisponible (${error.code})`);
  const d = data as Dashboard;

  if (!d.profile || !d.enrollment || d.state === "none") redirect("/onboarding");
  if (d.level_up) redirect("/app/niveau");
  if ((d.unseen_achievements ?? 0) > 0) redirect("/app/succes");

  const e = d.enrollment;
  const stats = d.stats!;
  const plan = d.plan!;
  // Jours d'essai restants, aujourd'hui compris (dernier jour : 1).
  const trialLeft = plan.trial_until ? Math.max(1, Math.round((Date.parse(plan.trial_until) - Date.parse(todayParis())) / 86_400_000) + 1) : 0;
  const principles = d.principles ?? [];
  const week = (weekData as WeekDay[] | null) ?? [];
  const remaining = principles.filter((p) => !p.validation);
  const atStake = remaining.reduce((sum, p) => sum + (["session", "reps", "reveil"].includes(p.proof_type) ? p.value : Math.round(p.value / 2)), 0);
  const running = d.state === "running";
  const jokersLeft = Math.max(0, e.jokers_total - e.jokers_used);
  const referralLink = d.profile.referral_code ? `${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(d.profile.referral_code)}` : null;
  const revenueGoal = e.goal_type === "revenu" && e.goal_target ? e.goal_target * 100 : null;
  const day = (date: string, weekday = false, year = true) => formatDay(date, locale, { weekday, year });
  // Photo du jour 1 : proposée pendant la première semaine, tant qu'elle n'est pas prise.
  const photoDaysLeft = running && !e.has_before_photo && d.day_number && d.day_number <= 7 ? 8 - d.day_number : 0;
  const rs = d.running_session;

  // Tous les principes, dans une seule liste : ceux du jour d'abord, puis ceux prévus un autre jour de la semaine.
  const refDay = running ? d.today! : e.start_date;
  const shown = new Set(principles.map((p) => p.id));
  const { data: allPrinciples } = await supabase
    .from("principles")
    .select("id, position, pillar, if_text, then_text, proof_type, difficulty, days, target, why, active_from, active_until")
    .eq("enrollment_id", e.id)
    .order("position");
  const otherDays: PrincipleView[] = (allPrinciples ?? [])
    .filter((p) => !shown.has(p.id) && p.active_from <= refDay && (!p.active_until || p.active_until >= refDay))
    .map((p) => ({
      id: p.id,
      position: p.position,
      pillar: p.pillar as PrincipleView["pillar"],
      if_text: p.if_text,
      then_text: p.then_text,
      proof_type: p.proof_type as PrincipleView["proof_type"],
      difficulty: p.difficulty,
      value: 10 * p.difficulty,
      days: p.days,
      target: (p.target ?? {}) as Target,
      why: p.why,
      validation: null,
    }));

  // Anneaux : principes prouvés aujourd'hui, jours verts de la semaine, jours verts de l'arc (75 pour le tenir).
  const doneToday = principles.filter((p) => p.validation && p.validation.status !== "rejected").length;
  const ringToday = d.joker_today ? { value: 1, max: 1 } : principles.length ? { value: doneToday, max: principles.length } : { value: running ? 1 : 0, max: 1 };
  const greenWeek = week.filter((w) => w.in_arc && (w.status === "green" || w.joker || (w.day === d.today && w.due > 0 && w.done >= w.due))).length;
  const greenArc = (d.calendar ?? []).filter((c) => c.status === "green" || c.status === "joker").length;
  const letters = week.map((w) => new Intl.DateTimeFormat(INTL[locale], { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${w.day}T12:00:00Z`)));

  const r = m.app.rewards;
  const month = d.today!.slice(0, 7);
  const levelSpan = Math.max(1, stats.level_next - stats.level_floor);
  const levelPct = Math.max(0, Math.min(1, (stats.xp - stats.level_floor) / levelSpan));

  const headline = d.day_number
    ? null
    : d.state === "draft"
      ? t.ready
      : d.state === "before"
        ? t.before
        : d.state === "ended"
          ? e.status === "completed"
            ? t.held
            : e.status === "abandoned"
              ? t.quit
              : t.ended
          : t.closing;

  return (
    <>
      {/* Fêtes : une fois par jour pour une journée prouvée, une fois par mois pour l'objectif de revenu atteint. */}
      {running && !d.joker_today && principles.length && !remaining.length ? (
        <CelebrationOverlay
          storageKey={`nonante:jour:${e.id}:${d.today}`}
          kind="day"
          hand={r.dayHand}
          title={r.dayTitle}
          text={fmt(r.dayText, { n: principles.length }, locale)}
        />
      ) : revenueGoal && plan.limits.wallet && (d.wallet_month_cents ?? 0) >= revenueGoal ? (
        <CelebrationOverlay
          storageKey={`nonante:objectif:${e.id}:${month}`}
          kind="goal"
          hand={r.goalHand}
          title={r.goalTitle}
          text={fmt(r.goalText, { amount: formatMoney(d.wallet_month_cents ?? 0, locale), target: formatMoney(revenueGoal, locale) })}
        />
      ) : null}

      <Aura tone="rose" />

      {/* En-tête : photo, salutation, points de la semaine */}
      <header className="relative z-10 flex animate-in items-center gap-3">
        <Link href="/app/profil" aria-label={t.profileAria} className="press rounded-full">
          <Avatar path={d.profile.avatar_path} pseudo={d.profile.pseudo} size={44} className="size-11" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-mute">{greeting(t)}</p>
          <p className="truncate font-display text-[19px] leading-tight">{d.profile.pseudo}</p>
        </div>
        <Link href="/classement" className="liquid press flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tabular-nums">
          {formatPoints(d.week_points ?? 0, locale)}
          <span className="text-[11px] font-medium text-mute">{d.rank ? `#${d.rank}` : t.pts}</span>
        </Link>
      </header>

      <div className="relative z-10 lg:mt-6 lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          {/* Le jour de l'arc et les anneaux */}
          <section className="mt-6 animate-in [animation-delay:60ms]">
            <p className={label}>{fmt(t.arc, { n: e.arc_number, goal: m.game.goals[e.goal_type].label })}</p>
            {d.day_number ? (
              <h1 className="mt-1 flex items-baseline gap-2">
                <span className="font-dot text-[58px] leading-none">{d.day_number}</span>
                <span className="font-display text-[22px] text-mute">{t.dayOf}</span>
              </h1>
            ) : (
              <h1 className="mt-1 font-display text-[34px] leading-tight">{headline}</h1>
            )}
            <p className="mt-1 text-[15px] leading-snug text-paper/80">{e.goal_title}</p>

            <Link href="/app/historique" aria-label={m.app.history.open} className="card press mt-5 block overflow-hidden p-5">
              <div className="flex items-center gap-5">
                <ActivityRings
                  rings={[
                    { ...ringToday, tone: "rose" },
                    { value: greenWeek, max: 7, tone: "mint" },
                    { value: greenArc, max: ARC_COMPLETION.minGreenDays, tone: "sky" },
                  ]}
                  size={136}
                  stroke={15}
                  gap={3}
                  label={fmt(t.ringsAria, { done: ringToday.value, due: ringToday.max, green: greenWeek, arc: greenArc })}
                  className="shrink-0"
                />
                <dl className="min-w-0 flex-1 space-y-3">
                  <div>
                    <dt className="text-[13px] text-mute">{t.ringToday}</dt>
                    <dd className={`font-display text-[22px] leading-tight tabular-nums ${RING_TEXT.rose}`}>
                      {d.joker_today ? t.jokerShort : `${ringToday.value}/${ringToday.max}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-mute">{t.ringWeek}</dt>
                    <dd className={`font-display text-[22px] leading-tight tabular-nums ${RING_TEXT.mint}`}>{fmt(t.ringWeekValue, { n: greenWeek })}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-mute">{t.ringArc}</dt>
                    <dd className={`font-display text-[22px] leading-tight tabular-nums ${RING_TEXT.sky}`}>{fmt(t.ringArcValue, { n: greenArc, max: ARC_COMPLETION.minGreenDays })}</dd>
                  </div>
                </dl>
              </div>
              {week.length ? (
                <div className="mt-5 border-t border-line pt-4">
                  <WeekRings
                    days={week}
                    letters={letters}
                    today={d.today!}
                    aria={(w) => fmt(t.weekDayAria, { date: day(w.day, true, false), done: w.done, due: w.due })}
                  />
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                  {t.streak} <span className="font-semibold tabular-nums">{fmt(t.streakDays, { n: stats.streak }, locale)}</span>
                </span>
                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                  {t.arcPoints} <span className="font-semibold tabular-nums">{formatPoints(d.points ?? 0, locale)}</span>
                </span>
                {e.jokers_total ? (
                  <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                    {t.jokers} <span className="font-semibold tabular-nums">{jokersLeft}</span>/{e.jokers_total}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-medium text-mute">
                {m.app.history.open}
                <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
                  <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
            </Link>
          </section>

          {params.essai === "1" && plan.trial ? (
            <div role="status" className="glow-violet mt-4 animate-in rounded-[1.75rem] p-5">
              <p className="font-display text-[22px]">{m.app.trial.welcomeTitle}</p>
              <p className="mt-1 text-sm text-paper/85">{m.app.trial.welcome}</p>
            </div>
          ) : plan.trial && plan.trial_until ? (
            <div className="card mt-4 p-4">
              <p className="text-[12px] font-semibold tracking-wide text-[#b79bff] uppercase">{m.app.trial.badge}</p>
              <p className="mt-1 font-display text-[19px] leading-tight">{fmt(m.app.trial.left, { n: trialLeft })}</p>
              <p className="mt-1 text-sm text-mute">{fmt(m.app.trial.leftText, { date: day(plan.trial_until, true) })}</p>
              <Link href="/abonnement" className={`${btnSmall} mt-3`}>
                {m.app.trial.choose}
              </Link>
            </div>
          ) : null}

          {params.paid === "1" && plan.plan ? (
            <div role="status" className="glow-violet mt-4 animate-in rounded-[1.75rem] p-5">
              <p className="font-display text-[22px]">{t.paidHand}</p>
              <p className="mt-1 text-sm text-paper/85">{d.state === "running" ? t.paidRunning : fmt(t.paidBefore, { date: day(e.start_date, true) })}</p>
              <Link href="/app/principes" className={`${btnSmall} mt-4`}>
                {t.adjust}
              </Link>
            </div>
          ) : params.paid === "1" ? (
            <div className="card mt-4 p-4 text-sm">
              {t.paidPending}{" "}
              <Link href="/app?paid=1" className="underline underline-offset-4">
                {t.refresh}
              </Link>
            </div>
          ) : null}

          {d.state === "locked" ? (
            <div className="card mt-4 p-4">
              <p className="text-sm">{!plan.trial_available && plan.trial_until && !plan.paid_plan ? m.app.trial.ended : t.locked}</p>
              <Link href="/abonnement" className={`${btnSmall} mt-3`}>
                {t.reactivate}
              </Link>
            </div>
          ) : null}

          {(d.audits ?? []).map((a) => (
            <Link key={a.id} href={`/app/controle/${a.id}`} className="glow-amber press mt-4 block rounded-[1.5rem] p-4">
              <p className="text-sm">
                {fmt(t.audit, {
                  label: a.label ? ` (${bareThen(a.label)})` : "",
                  due: new Intl.DateTimeFormat(INTL[locale], { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(a.due_at)),
                  penalty: signed(-a.penalty),
                })}
              </p>
            </Link>
          ))}

          {rs ? (
            <Link
              href={rs.principle_id ? `/app/${rs.kind}/${rs.principle_id}` : `/app/${rs.kind}/${rs.assignment_id}?epreuve=1`}
              className="glow-rose press mt-4 block rounded-[1.5rem] p-4 text-sm"
            >
              {rs.kind === "session" ? t.running : t.runningReps}
            </Link>
          ) : null}

          {d.state === "draft" ? (
            <section className="glow-violet mt-4 rounded-[1.75rem] p-5">
              <p className="font-display text-[22px] leading-tight">{t.draftTitle}</p>
              {plan.trial_available ? (
                <>
                  <p className="mt-2 text-sm text-paper/85">{fmt(m.app.trial.draftTrial, { date: day(e.start_date, true) })}</p>
                  <div className="mt-5">
                    <TrialButton />
                  </div>
                  <Link href="/abonnement" className="mt-3 block text-center text-sm text-mute underline underline-offset-4">
                    {m.quiz.suite.orPay}
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-paper/85">{fmt(t.draftText, { date: day(e.start_date, true), price: formatMoney(1999, locale) })}</p>
                  <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
                    {t.launch}
                  </Link>
                </>
              )}
            </section>
          ) : null}

          {d.state === "before" ? (
            <section className="card mt-4 p-5">
              <p className="text-sm text-mute">{fmt(t.beforeText, { date: day(e.start_date, true) })}</p>
              <div className="mt-4">
                <Countdown target={parisMidnight(e.start_date).getTime()} serverNow={serverNow()} />
              </div>
              <div className="mt-6">
                <StartTodayButton today={d.today!} />
              </div>
            </section>
          ) : null}

          {/* Principes : tous, ceux du jour d'abord */}
          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className={sectionTitle}>{running || d.state === "locked" ? t.today : t.principles}</h2>
              <Link href="/app/principes" className={btnSmall}>
                {t.edit}
              </Link>
            </div>
            {running ? (
              <p className="mt-1 text-sm text-mute">
                {d.joker_today
                  ? t.joker
                  : remaining.length
                    ? fmt(t.toProve, { n: remaining.length, points: atStake }, locale)
                    : principles.length
                      ? t.allDone
                      : t.nothing}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2.5">
              {principles.map((p) => (
                <TodayPrinciple key={p.id} principle={p} disabled={!running} />
              ))}
              {otherDays.map((p) => (
                <TodayPrinciple key={p.id} principle={p} disabled offDay={fmt(t.notToday, { days: daysLabel(p.days, m) })} />
              ))}
              {!principles.length && !otherDays.length ? <li className="card p-5 text-sm text-mute">{t.nothingDay}</li> : null}
            </ul>
            {running && !d.joker_today && jokersLeft > 0 && remaining.length ? (
              <div className="mt-3 flex justify-center">
                <JokerButton left={jokersLeft} />
              </div>
            ) : null}
          </section>
        </div>

        <div>
          {revenueGoal && plan.limits.wallet ? (
            <Link href="/app/portefeuille" className="card press mt-8 block p-5 lg:mt-6">
              <p className="flex items-baseline justify-between text-[13px] text-mute">
                <span>{t.monthIncomeLabel}</span>
                <span>{fmt(t.incomeGoal, { amount: formatMoney(revenueGoal, locale) })}</span>
              </p>
              <p className="mt-1 font-display text-[28px] leading-none tabular-nums">{formatMoney(d.wallet_month_cents ?? 0, locale)}</p>
              <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <span className={`block h-2 rounded-full bg-linear-to-r from-[#1fbf7a] to-[#9bf5c9] ${WIDTHS[Math.min(10, Math.floor(((d.wallet_month_cents ?? 0) / revenueGoal) * 10))]}`} />
              </span>
            </Link>
          ) : null}

          {photoDaysLeft ? (
            <section className="glow-amber mt-4 rounded-[1.75rem] p-5">
              <p className="font-display text-[22px] leading-tight">{t.photoTitle}</p>
              <p className="mt-2 text-sm text-paper/85">{t.photoText}</p>
              <Link href="/app/avant-apres" className={`${btnPrimary} mt-5`}>
                {t.photoCta}
              </Link>
              <p className="mt-3 text-center text-xs text-paper/70">{fmt(t.photoLeft, { n: photoDaysLeft }, locale)}</p>
            </section>
          ) : null}

          {running && d.challenge ? (
            <Link href="/app/quete" className="glow-violet press mt-4 block rounded-[1.75rem] p-5">
              <p className="text-[13px] font-medium text-paper/75">{d.challenge.kind === "piege" ? t.trap : fmt(t.quest, { n: d.challenge.week })}</p>
              <p className="mt-1 font-display text-[20px] leading-snug">{m.content.challenges[d.challenge.code ?? ""]?.title ?? d.challenge.title}</p>
              <p className="mt-3 flex items-center justify-between gap-4 text-sm">
                <span className="rounded-full bg-black/30 px-3 py-1 tabular-nums">
                  {d.challenge.status === "done" ? t.questDone : d.challenge.status === "failed" ? t.questFailed : challengeProgress(d.challenge, t)}
                </span>
                <span className="text-xs text-paper/75">{fmt(t.questPoints, { done: signed(d.challenge.points_done), failed: signed(d.challenge.points_failed) })}</span>
              </p>
            </Link>
          ) : null}

          {/* Calendrier */}
          {d.calendar?.length ? (
            <section className="card mt-4 p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-[17px]">{t.calendar}</h2>
                <span className="text-[13px] text-mute tabular-nums">{fmt(t.calendarCount, { n: greenArc })}</span>
              </div>
              <CalendarInteractive days={d.calendar} />
              <CalendarLegend />
            </section>
          ) : null}

          {/* Niveau */}
          <Link href="/app/profil" className="card press mt-4 block p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-mute">{t.levelLabel}</p>
                <p className="font-display text-[20px] leading-tight">{fmt(t.levelRow, { level: stats.level, title: titleFor(stats.level, m) })}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-[28px] leading-none tabular-nums">{stats.ovr}</p>
                <p className="text-[11px] text-mute">{m.game.stats.overall}</p>
              </div>
            </div>
            <span className="mt-4 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <span className={`block h-1.5 rounded-full bg-linear-to-r from-[#b79bff] to-[#8358e8] ${WIDTHS[Math.floor(levelPct * 10)]}`} />
            </span>
            <p className="mt-2 flex justify-between text-[12px] text-mute tabular-nums">
              <span>{fmt(m.game.stats.xp, { xp: formatNumber(stats.xp, locale) })}</span>
              <span>{fmt(m.game.stats.nextLevel, { level: stats.level + 1, xp: formatNumber(stats.level_next, locale) })}</span>
            </p>
          </Link>

          <QuoteCard date={d.today!} className="mt-4 px-1" />

          {d.state === "ended" ? (
            <section className="card mt-4 p-5">
              <p className="text-mute">
                {e.status === "completed" ? (plan.paid_plan === "pro" ? t.endedHeldPro : t.endedHeld) : e.status === "abandoned" ? t.endedQuit : t.endedFailed}
              </p>
              <Link href="/onboarding" className={`${btnPrimary} mt-6`}>
                {t.nextArc}
              </Link>
            </section>
          ) : null}

          <nav className="grouped mt-6 overflow-hidden" aria-label={t.shortcuts}>
            <Link href="/app/escouades" className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.04]">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{t.squads}</span>
                <span className="block text-[13px] text-mute">{t.squadsHint}</span>
              </span>
              <Chevron />
            </Link>
            <Link href="/app/avant-apres" className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.04]">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{t.beforeAfter}</span>
                <span className="block text-[13px] text-mute">{t.beforeAfterHint}</span>
              </span>
              <Chevron />
            </Link>
            {referralLink && d.profile.referral_code ? (
              <ReferralRow
                code={d.profile.referral_code}
                link={referralLink}
                shareUrl={
                  d.profile.is_public
                    ? `${siteUrl()}/u/${encodeURIComponent(d.profile.pseudo)}?utm_source=parrainage&utm_campaign=${encodeURIComponent(d.profile.referral_code)}`
                    : null
                }
              />
            ) : null}
          </nav>
        </div>
      </div>
    </>
  );
}
