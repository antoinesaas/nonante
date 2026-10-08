import Link from "next/link";
import { redirect } from "next/navigation";
import { JokerButton, StartTodayButton } from "@/app/app/(main)/DayActions";
import { ArtBand } from "@/components/Art";
import { CalendarInteractive } from "@/components/CalendarInteractive";
import { CopyButton } from "@/components/CopyButton";
import { ShareProfileButton } from "@/components/ShareProfileButton";
import { Countdown } from "@/components/Countdown";
import { CalendarLegend } from "@/components/DotCalendar";
import { Hand } from "@/components/Hand";
import { Avatar, StatGrid, XpBar } from "@/components/Player";
import { QuoteCard } from "@/components/QuoteCard";
import { TodayPrinciple } from "@/components/TodayPrinciple";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { parisMidnight } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { INTL } from "@/lib/i18n/config";
import { fmt, formatDay, formatMoney, formatPoints, signed } from "@/lib/i18n/format";
import { bareThen, titleFor } from "@/lib/i18n/labels";
import type { Messages } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { fulfillCheckout } from "@/lib/payments";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import type { ChallengeView, Dashboard } from "@/lib/types";
import { btnLink, btnPrimary, btnSmall, label } from "@/lib/ui";

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

  const { data, error } = await supabase.rpc("my_dashboard");
  if (error) throw new Error(`Tableau de bord indisponible (${error.code})`);
  const d = data as Dashboard;

  if (!d.profile || !d.enrollment || d.state === "none") redirect("/onboarding");
  if (d.level_up) redirect("/app/niveau");
  if ((d.unseen_achievements ?? 0) > 0) redirect("/app/succes");

  const e = d.enrollment;
  const stats = d.stats!;
  const plan = d.plan!;
  const principles = d.principles ?? [];
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

  return (
    <>
      {/* Joueur */}
      <header className="flex items-center gap-4">
        <Link href="/app/profil" aria-label={t.profileAria} className="transition-transform active:scale-95">
          <Avatar path={d.profile.avatar_path} pseudo={d.profile.pseudo} size={52} className="size-13" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-2xl leading-none">{d.profile.pseudo}</p>
          <p className="mt-1 text-xs text-mute">{fmt(t.line, { level: stats.level, title: titleFor(stats.level, m), ovr: stats.ovr })}</p>
        </div>
        <Link href="/classement" className="text-right">
          <p className="font-serif text-3xl leading-none tabular-nums">{formatPoints(d.week_points ?? 0, locale)}</p>
          <p className="mt-1 text-[11px] text-mute">{d.rank ? fmt(d.rank === 1 ? t.rankFirst : t.rank, { rank: d.rank, total: d.total ?? 0 }) : t.weekPoints}</p>
        </Link>
      </header>
      <div className="mt-4">
        <XpBar stats={stats} />
      </div>

      {params.paid === "1" && plan.plan ? (
        <div role="status" className="mt-6 animate-rise rounded-xs border border-paper p-5">
          <p className="font-hand text-3xl leading-none">{t.paidHand}</p>
          <p className="mt-2 text-sm">{d.state === "running" ? t.paidRunning : fmt(t.paidBefore, { date: day(e.start_date, true) })}</p>
          <Link href="/app/principes" className={`${btnLink} mt-3 inline-block`}>
            {t.adjust}
          </Link>
        </div>
      ) : params.paid === "1" ? (
        <div className="mt-6 rounded-xs border border-line p-4 text-sm">
          {t.paidPending}{" "}
          <Link href="/app?paid=1" className={btnLink}>
            {t.refresh}
          </Link>
        </div>
      ) : null}

      {d.state === "locked" ? (
        <div className="mt-6 rounded-xs border border-paper p-4">
          <p className="text-sm">{t.locked}</p>
          <Link href="/abonnement" className={`${btnSmall} mt-3`}>
            {t.reactivate}
          </Link>
        </div>
      ) : null}

      {(d.audits ?? []).map((a) => (
        <Link key={a.id} href={`/app/controle/${a.id}`} className="mt-6 block rounded-xs border border-paper p-4 transition-colors hover:bg-surface">
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
          className="mt-6 block rounded-xs border border-paper p-4 text-sm"
        >
          {rs.kind === "session" ? t.running : t.runningReps}
        </Link>
      ) : null}

      <div className="lg:mt-4 lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div>
          {/* L'arc */}
          <section className="mt-10 animate-rise">
            <p className={label}>{fmt(t.arc, { n: e.arc_number, goal: m.game.goals[e.goal_type].label })}</p>
            <h1 className="mt-3 font-serif text-6xl leading-none">
              {d.day_number ? (
                <>
                  {fmt(t.day, { n: d.day_number })} <span className="text-mute">/ 90</span>
                </>
              ) : d.state === "draft" ? (
                t.ready
              ) : d.state === "before" ? (
                t.before
              ) : d.state === "ended" ? (
                e.status === "completed" ? t.held : e.status === "abandoned" ? t.quit : t.ended
              ) : (
                t.closing
              )}
            </h1>
            <p className="mt-4 text-lg leading-snug">{e.goal_title}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
              <span>
                {t.streak} <span className="text-paper tabular-nums">{fmt(t.streakDays, { n: stats.streak }, locale)}</span>
              </span>
              <span>
                {t.arcPoints} <span className="text-paper tabular-nums">{formatPoints(d.points ?? 0, locale)}</span>
              </span>
              {e.jokers_total ? (
                <span>
                  {t.jokers} <span className="text-paper tabular-nums">{jokersLeft}</span> / {e.jokers_total}
                </span>
              ) : null}
            </div>
            {revenueGoal && plan.limits.wallet ? (
              <Link href="/app/portefeuille" className="mt-5 block">
                <p className="flex justify-between text-xs text-mute">
                  <span>{fmt(t.monthIncome, { amount: formatMoney(d.wallet_month_cents ?? 0, locale) })}</span>
                  <span>{fmt(t.incomeGoal, { amount: formatMoney(revenueGoal, locale) })}</span>
                </p>
                <span className="mt-1.5 block h-1 w-full bg-line">
                  <span className={`block h-1 bg-paper ${WIDTHS[Math.min(10, Math.floor(((d.wallet_month_cents ?? 0) / revenueGoal) * 10))]}`} />
                </span>
              </Link>
            ) : null}
          </section>

          {photoDaysLeft ? (
            <section className="mt-8 animate-rise overflow-hidden rounded-xs border border-paper [animation-delay:120ms]">
              <ArtBand slug={IMAGES.road} className="h-32" />
              <div className="p-5">
                <Hand className="text-2xl text-mute">{t.photoHand}</Hand>
                <p className="mt-1 font-serif text-3xl leading-tight">{t.photoTitle}</p>
                <p className="mt-2 text-sm text-mute">{t.photoText}</p>
                <Link href="/app/avant-apres" className={`${btnPrimary} mt-5`}>
                  {t.photoCta}
                </Link>
                <p className="mt-3 text-xs text-mute">{fmt(t.photoLeft, { n: photoDaysLeft }, locale)}</p>
              </div>
            </section>
          ) : null}

          {d.state === "draft" ? (
            <section className="mt-8 rounded-xs border border-paper p-5">
              <p className="font-serif text-2xl leading-tight">{t.draftTitle}</p>
              <p className="mt-2 text-sm text-mute">{fmt(t.draftText, { date: day(e.start_date, true), price: formatMoney(1999, locale) })}</p>
              <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
                {t.launch}
              </Link>
              <Link href="/app/principes" className={`${btnLink} mt-4 inline-block`}>
                {t.review}
              </Link>
            </section>
          ) : null}

          {d.state === "before" ? (
            <section className="mt-8">
              <p className="text-mute">{fmt(t.beforeText, { date: day(e.start_date, true) })}</p>
              <div className="mt-6">
                <Countdown target={parisMidnight(e.start_date).getTime()} serverNow={serverNow()} />
              </div>
              <div className="mt-8">
                <StartTodayButton today={d.today!} />
              </div>
            </section>
          ) : null}

          {/* Aujourd'hui */}
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-3xl">{running || d.state === "locked" ? t.today : t.principles}</h2>
              <Link href="/app/principes" className={btnLink}>
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
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {principles.map((p) => (
                <TodayPrinciple key={p.id} principle={p} disabled={!running} />
              ))}
              {!principles.length ? <li className="py-5 text-sm text-mute">{t.nothingDay}</li> : null}
            </ul>
            {running && !d.joker_today && jokersLeft > 0 && remaining.length ? (
              <div className="mt-4">
                <JokerButton left={jokersLeft} />
              </div>
            ) : null}
          </section>
        </div>

        <div>
          {/* Calendrier */}
          {d.calendar?.length ? (
            <section className="mt-10">
              <CalendarInteractive days={d.calendar} />
              <CalendarLegend />
            </section>
          ) : null}

          {running && d.challenge ? (
            <Link href="/app/quete" className="mt-10 block rounded-xs border border-line p-4 transition-colors hover:border-mute">
              <p className={label}>{d.challenge.kind === "piege" ? t.trap : fmt(t.quest, { n: d.challenge.week })}</p>
              <p className="mt-2 flex items-baseline justify-between gap-4">
                <span>{m.content.challenges[d.challenge.code ?? ""]?.title ?? d.challenge.title}</span>
                <span className="shrink-0 text-sm text-mute tabular-nums">
                  {d.challenge.status === "done" ? t.questDone : d.challenge.status === "failed" ? t.questFailed : challengeProgress(d.challenge, t)}
                </span>
              </p>
              <p className="mt-1 text-xs text-mute">{fmt(t.questPoints, { done: signed(d.challenge.points_done), failed: signed(d.challenge.points_failed) })}</p>
            </Link>
          ) : null}

          <ArtBand slug={IMAGES.quote} className="-mx-5 mt-10 h-auto min-h-56 lg:mx-0" dark>
            <QuoteCard date={d.today!} />
          </ArtBand>

          {/* Stats */}
          <Link href="/app/profil" className="mt-10 block rounded-xs border border-line p-4 transition-colors hover:border-mute">
            <div className="flex items-baseline justify-between">
              <p className={label}>{t.stats}</p>
              <p className="font-serif text-3xl leading-none tabular-nums">{stats.ovr}</p>
            </div>
            <div className="mt-4">
              <StatGrid stats={stats} compact />
            </div>
            <p className="mt-4 text-xs text-mute">{t.statsHint}</p>
          </Link>

          {d.state === "ended" ? (
            <section className="mt-10 border-t border-line pt-8">
              <p className="text-mute">
                {e.status === "completed" ? (plan.paid_plan === "pro" ? t.endedHeldPro : t.endedHeld) : e.status === "abandoned" ? t.endedQuit : t.endedFailed}
              </p>
              <Link href="/onboarding" className={`${btnPrimary} mt-6`}>
                {t.nextArc}
              </Link>
            </section>
          ) : null}

          <nav className="mt-10 grid grid-cols-2 gap-3 text-sm" aria-label={t.shortcuts}>
            <Link href="/app/escouades" className="rounded-xs border border-line p-4 transition-[border-color,transform] hover:border-mute active:scale-[0.98]">
              {t.squads}
              <span className="mt-1 block text-xs text-mute">{t.squadsHint}</span>
            </Link>
            <Link href="/app/avant-apres" className="rounded-xs border border-line p-4 transition-[border-color,transform] hover:border-mute active:scale-[0.98]">
              {t.beforeAfter}
              <span className="mt-1 block text-xs text-mute">{t.beforeAfterHint}</span>
            </Link>
          </nav>

          {referralLink && d.profile.referral_code ? (
            <section className="mt-10 border-t border-line pt-6">
              <p className={label}>{t.referral}</p>
              <p className="mt-3 text-sm text-mute">{t.referralText}</p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="font-serif text-2xl">{d.profile.referral_code}</span>
                <CopyButton value={`${d.profile.referral_code} · ${referralLink}`} label={t.copy} />
              </div>
              {d.profile.is_public ? (
                <ShareProfileButton
                  url={`${siteUrl()}/u/${encodeURIComponent(d.profile.pseudo)}?utm_source=parrainage&utm_campaign=${encodeURIComponent(d.profile.referral_code)}`}
                  code={d.profile.referral_code}
                  className="mt-4"
                />
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
